import Groq, { APIError } from 'groq-sdk';
import { env } from '../config/env';
import type { Job } from '../types/job';
import type { ResumeProfile } from '../types/resume';
import type { JobMatchResult, MatchRecommendation } from '../types/ai-match';

const MODEL = 'openai/gpt-oss-20b';
const LOG_PREFIX = '[ai-matcher.service]';

const MATCH_RECOMMENDATIONS: readonly MatchRecommendation[] = [
  'strong_match',
  'match',
  'weak_match',
  'not_a_match',
];

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!env.groqApiKey) {
    throw new Error(
      'GROQ_API_KEY is not set. Add it to your .env file (see .env.example) before using the AI matcher.',
    );
  }
  if (!groqClient) {
    groqClient = new Groq({ apiKey: env.groqApiKey });
  }
  return groqClient;
}

// Groq Structured Outputs (json_schema, strict mode) — the model's response
// is guaranteed to match this shape, but we still validate it defensively
// (see validateJobMatchResult) since "matches the schema" isn't the same as
// "contains sane values" (e.g. a matchScore of 500).
const JOB_MATCH_JSON_SCHEMA = {
  type: 'object',
  properties: {
    matchScore: {
      type: 'integer',
      description: 'Overall realistic fit score from 0 (no fit) to 100 (ideal fit).',
    },
    recommendation: {
      type: 'string',
      enum: MATCH_RECOMMENDATIONS,
      description: 'Overall recommendation bucket derived from matchScore and the requirement gaps found.',
    },
    matchingSkills: {
      type: 'array',
      items: { type: 'string' },
      description: "Candidate skills/experience that satisfy something the job explicitly asks for.",
    },
    missingSkills: {
      type: 'array',
      items: { type: 'string' },
      description: 'Required or preferred skills the job asks for that the candidate profile does not show.',
    },
    reasons: {
      type: 'array',
      items: { type: 'string' },
      description: 'Short, factual justifications for the score, grounded only in the job posting and resume.',
    },
    concerns: {
      type: 'array',
      items: { type: 'string' },
      description: 'Risks or gaps a human reviewer should weigh, e.g. an experience or education shortfall.',
    },
  },
  required: ['matchScore', 'recommendation', 'matchingSkills', 'missingSkills', 'reasons', 'concerns'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are a strict, evidence-based technical recruiter assistant. You compare one job posting against one candidate resume and score how well the candidate fits the job.

Rules you must follow:
- Base every judgement only on the job posting text and resume data given to you. Never invent, assume, or infer candidate experience, skills, or education that is not stated.
- Never assume a candidate has a skill just because a related or similar skill is listed (e.g. knowing React does not imply knowing Vue; knowing SQL does not imply knowing a specific database like MongoDB).
- Read the job posting to identify which skills/requirements are REQUIRED (must-have) versus PREFERRED (nice-to-have). Treat these differently: missing a required skill matters far more than missing a preferred one.
- Heavily penalize the score when critical/required requirements are missing from the candidate profile.
- Do not give a high score merely because the job title matches or sounds similar to the candidate's target roles. Titles can be misleading; judge substance (responsibilities, required skills, experience level) instead.
- If the job clearly requires more years of experience, or a more senior level, than the candidate's profile shows, reflect that clearly with a lower score and a concern explaining the gap. Do not round up.
- Compare education requirements (if any are stated) against the candidate's education literally; do not assume equivalence between unrelated fields of study.
- matchScore must be an integer from 0 to 100 and must be realistic and discriminating: reserve 85+ for jobs that are a genuinely strong, well-evidenced fit. A generic or partial fit should usually score well below that.
- recommendation must be consistent with matchScore: roughly 85-100 = strong_match, 60-84 = match, 35-59 = weak_match, 0-34 = not_a_match.
- Every entry in matchingSkills/missingSkills/reasons/concerns must be a short, specific, factual statement, not generic filler.
- Respond only with the structured JSON result. Do not include any text outside the JSON.`;

function formatResumeForPrompt(resume: ResumeProfile): string {
  const workExperience = resume.workExperience
    .map((entry) => {
      const responsibilities = entry.responsibilities.length
        ? `\n    Responsibilities: ${entry.responsibilities.join('; ')}`
        : '';
      const achievements = entry.achievements.length
        ? `\n    Achievements: ${entry.achievements.join('; ')}`
        : '';
      const skills = entry.skills.length ? `\n    Skills used: ${entry.skills.join(', ')}` : '';
      return `  - ${entry.role} at ${entry.company} (${entry.duration})${responsibilities}${achievements}${skills}`;
    })
    .join('\n');

  const education = resume.education
    .map(
      (entry) =>
        `  - ${entry.degree} in ${entry.field}, ${entry.institution} (${entry.startYear}-${entry.endYear ?? 'present'})`,
    )
    .join('\n');

  return `Name: ${resume.name}
Professional summary: ${resume.professionalSummary}
Years of experience (total, as stated): ${resume.yearsOfExperience}
Target roles: ${resume.targetRoles.join(', ') || 'none stated'}
Preferred work type: ${resume.preferredWorkType}

Skills: ${resume.skills.join(', ') || 'none stated'}
Technical skills: ${resume.technicalSkills.join(', ') || 'none stated'}
Programming languages: ${resume.programmingLanguages.join(', ') || 'none stated'}
Tools: ${resume.tools.join(', ') || 'none stated'}
Analytical skills: ${resume.analyticalSkills.join(', ') || 'none stated'}
Product skills: ${resume.productSkills.join(', ') || 'none stated'}

Education:
${education || '  none stated'}

Work experience:
${workExperience || '  none stated'}

Projects: ${resume.projects.join(', ') || 'none stated'}
Certifications: ${resume.certifications.join(', ') || 'none stated'}
Industries: ${resume.industries.join(', ') || 'none stated'}`;
}

function formatJobForPrompt(job: Job): string {
  const description = job.description.trim() || '(no job description provided by the source)';
  return `Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Tags/keywords from listing: ${job.tags.join(', ') || 'none'}

Full job posting (extract responsibilities, required skills, preferred skills, experience requirements, and education requirements from this text):
${description}`;
}

function buildUserPrompt(job: Job, resume: ResumeProfile): string {
  return `## Job Posting
${formatJobForPrompt(job)}

## Candidate Resume
${formatResumeForPrompt(resume)}

Evaluate how well this candidate matches this job and respond with the structured JSON result.`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * Validates that a parsed JSON value matches JobMatchResult, throwing a
 * single error listing every problem found. Structured Outputs constrains
 * the model's response shape, but not value sanity (e.g. an out-of-range
 * score), so this still needs to run before the result is trusted.
 */
export function validateJobMatchResult(value: unknown): JobMatchResult {
  if (typeof value !== 'object' || value === null) {
    throw new Error('AI match result must be a JSON object.');
  }
  const candidate = value as Record<string, unknown>;
  const problems: string[] = [];

  if (
    typeof candidate.matchScore !== 'number' ||
    !Number.isFinite(candidate.matchScore) ||
    candidate.matchScore < 0 ||
    candidate.matchScore > 100
  ) {
    problems.push('"matchScore" must be a number between 0 and 100.');
  }
  if (
    typeof candidate.recommendation !== 'string' ||
    !MATCH_RECOMMENDATIONS.includes(candidate.recommendation as MatchRecommendation)
  ) {
    problems.push(`"recommendation" must be one of: ${MATCH_RECOMMENDATIONS.join(', ')}.`);
  }
  if (!isStringArray(candidate.matchingSkills)) problems.push('"matchingSkills" must be an array of strings.');
  if (!isStringArray(candidate.missingSkills)) problems.push('"missingSkills" must be an array of strings.');
  if (!isStringArray(candidate.reasons)) problems.push('"reasons" must be an array of strings.');
  if (!isStringArray(candidate.concerns)) problems.push('"concerns" must be an array of strings.');

  if (problems.length > 0) {
    throw new Error(`Invalid AI match result:\n- ${problems.join('\n- ')}`);
  }

  return candidate as unknown as JobMatchResult;
}

/**
 * Sends a job and a resume profile to Groq (openai/gpt-oss-20b) and returns
 * a structured, schema-validated match assessment. Never sends the result
 * anywhere (Telegram, disk, etc.) — that's the caller's responsibility.
 */
export async function matchJobToResume(job: Job, resume: ResumeProfile): Promise<JobMatchResult> {
  const client = getGroqClient();

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(job, resume) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'job_match_result',
          strict: true,
          schema: JOB_MATCH_JSON_SCHEMA,
        },
      },
    });
  } catch (error) {
    if (error instanceof APIError) {
      throw new Error(
        `Groq API request failed (status ${error.status ?? 'unknown'}): ${error.message}`,
      );
    }
    throw new Error(
      `Failed to reach Groq API: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Groq API returned an empty response for job match evaluation.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Groq API returned invalid JSON for job match evaluation: ${error instanceof Error ? error.message : error}`,
    );
  }

  const result = validateJobMatchResult(parsed);
  console.log(
    `${LOG_PREFIX} Matched "${job.title}" @ ${job.company}: score=${result.matchScore} (${result.recommendation}).`,
  );
  return result;
}
