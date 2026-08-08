import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { EducationEntry, PreferredWorkType, ResumeProfile, WorkExperienceEntry } from '../types/resume';

// Resolved relative to this file so the location is the same whether the
// app runs via `tsx src/...` or the compiled `dist/...`, regardless of the
// directory the process was launched from (same approach as memory.service.ts).
const MEMORY_DIR = path.resolve(__dirname, '../../memory');
const RESUME_FILE = path.join(MEMORY_DIR, 'resume.json');

const LOG_PREFIX = '[resume.service]';

const PREFERRED_WORK_TYPES: readonly PreferredWorkType[] = ['remote', 'hybrid', 'onsite', 'any'];

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isEducationEntry(value: unknown): value is EducationEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.institution === 'string' &&
    typeof entry.degree === 'string' &&
    typeof entry.field === 'string' &&
    typeof entry.startYear === 'number' &&
    (entry.endYear === null || typeof entry.endYear === 'number')
  );
}

function isWorkExperienceEntry(value: unknown): value is WorkExperienceEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.company === 'string' &&
    typeof entry.role === 'string' &&
    typeof entry.duration === 'string' &&
    isStringArray(entry.responsibilities) &&
    isStringArray(entry.achievements) &&
    isStringArray(entry.skills)
  );
}

/**
 * Validates that an unknown value (typically freshly-parsed JSON) matches
 * the ResumeProfile shape, throwing a single error listing every problem
 * found rather than failing on the first one. Exported so a future service
 * that builds a ResumeProfile from another source (e.g. an LLM parsing a
 * PDF) can validate its output before calling saveResumeProfile().
 */
export function validateResumeProfile(value: unknown): ResumeProfile {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Resume profile at ${RESUME_FILE} must be a JSON object.`);
  }
  const candidate = value as Record<string, unknown>;
  const problems: string[] = [];

  if (typeof candidate.name !== 'string' || candidate.name.trim() === '') {
    problems.push('"name" must be a non-empty string.');
  }
  if (typeof candidate.professionalSummary !== 'string') {
    problems.push('"professionalSummary" must be a string.');
  }
  if (!Array.isArray(candidate.education) || !candidate.education.every(isEducationEntry)) {
    problems.push(
      '"education" must be an array of { institution, degree, field, startYear, endYear }.',
    );
  }
  if (!isStringArray(candidate.targetRoles)) problems.push('"targetRoles" must be an array of strings.');
  if (!isStringArray(candidate.skills)) problems.push('"skills" must be an array of strings.');
  if (!isStringArray(candidate.technicalSkills)) {
    problems.push('"technicalSkills" must be an array of strings.');
  }
  if (!isStringArray(candidate.analyticalSkills)) {
    problems.push('"analyticalSkills" must be an array of strings.');
  }
  if (!isStringArray(candidate.productSkills)) {
    problems.push('"productSkills" must be an array of strings.');
  }
  if (!isStringArray(candidate.tools)) problems.push('"tools" must be an array of strings.');
  if (!isStringArray(candidate.programmingLanguages)) {
    problems.push('"programmingLanguages" must be an array of strings.');
  }
  if (!Array.isArray(candidate.workExperience) || !candidate.workExperience.every(isWorkExperienceEntry)) {
    problems.push(
      '"workExperience" must be an array of { company, role, duration, responsibilities, achievements, skills }.',
    );
  }
  if (!isStringArray(candidate.projects)) problems.push('"projects" must be an array of strings.');
  if (!isStringArray(candidate.certifications)) {
    problems.push('"certifications" must be an array of strings.');
  }
  if (!isStringArray(candidate.industries)) problems.push('"industries" must be an array of strings.');
  if (typeof candidate.yearsOfExperience !== 'number' || candidate.yearsOfExperience < 0) {
    problems.push('"yearsOfExperience" must be a non-negative number.');
  }
  if (
    typeof candidate.preferredWorkType !== 'string' ||
    !PREFERRED_WORK_TYPES.includes(candidate.preferredWorkType as PreferredWorkType)
  ) {
    problems.push(`"preferredWorkType" must be one of: ${PREFERRED_WORK_TYPES.join(', ')}.`);
  }

  if (problems.length > 0) {
    throw new Error(`Invalid resume profile at ${RESUME_FILE}:\n- ${problems.join('\n- ')}`);
  }

  return candidate as unknown as ResumeProfile;
}

/**
 * Loads and validates the resume profile from memory/resume.json.
 *
 * Unlike memory.service.ts's loadSeenJobs(), this does NOT self-heal a
 * missing/invalid file by falling back to an empty default. Seen-jobs is a
 * dedup cache where "empty" is a safe, meaningful starting state; a resume
 * profile is required input with no sensible default; silently continuing
 * with an empty one would make the agent reason about a person with no
 * skills or experience, which is worse than failing loudly.
 */
export async function loadResumeProfile(): Promise<ResumeProfile> {
  let raw: string;
  try {
    raw = await readFile(RESUME_FILE, 'utf-8');
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      throw new Error(
        `Resume profile not found at ${RESUME_FILE}. ` +
          'The resume profile has not been created yet — call saveResumeProfile() ' +
          'with a valid ResumeProfile (see src/types/resume.ts) before using it.',
      );
    }
    throw new Error(
      `Failed to read resume profile at ${RESUME_FILE}: ${error instanceof Error ? error.message : error}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Resume profile at ${RESUME_FILE} contains invalid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }

  const profile = validateResumeProfile(parsed);
  console.log(`${LOG_PREFIX} Loaded resume profile for "${profile.name}".`);
  return profile;
}

/** Validates and writes a resume profile to memory/resume.json. */
export async function saveResumeProfile(profile: ResumeProfile): Promise<void> {
  validateResumeProfile(profile);

  await mkdir(MEMORY_DIR, { recursive: true });
  await writeFile(RESUME_FILE, JSON.stringify(profile, null, 2), 'utf-8');
  console.log(`${LOG_PREFIX} Saved resume profile for "${profile.name}" to ${RESUME_FILE}.`);
}
