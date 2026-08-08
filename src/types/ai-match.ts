export type MatchRecommendation = 'strong_match' | 'match' | 'weak_match' | 'not_a_match';

export interface JobMatchResult {
  /** Realistic overall fit score from 0 (no fit) to 100 (ideal fit). */
  matchScore: number;
  recommendation: MatchRecommendation;
  /** Candidate skills/experience that satisfy something the job asks for. */
  matchingSkills: string[];
  /** Skills the job asks for (required or preferred) that the candidate's profile does not show. */
  missingSkills: string[];
  /** Short factual justifications grounded in the job posting and resume. */
  reasons: string[];
  /** Risks or gaps a human reviewer should weigh, e.g. an experience shortfall. */
  concerns: string[];
}
