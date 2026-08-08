export interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  startYear: number;
  /** null means the program is still in progress. */
  endYear: number | null;
}

export interface WorkExperienceEntry {
  company: string;
  role: string;
  /** Free-form, e.g. "Jan 2022 - Present" — not parsed/structured yet. */
  duration: string;
  responsibilities: string[];
  achievements: string[];
  skills: string[];
}

export type PreferredWorkType = 'remote' | 'hybrid' | 'onsite' | 'any';

export interface ResumeProfile {
  name: string;
  professionalSummary: string;
  education: EducationEntry[];
  targetRoles: string[];
  skills: string[];
  technicalSkills: string[];
  analyticalSkills: string[];
  productSkills: string[];
  tools: string[];
  programmingLanguages: string[];
  workExperience: WorkExperienceEntry[];
  projects: string[];
  certifications: string[];
  industries: string[];
  yearsOfExperience: number;
  preferredWorkType: PreferredWorkType;
}
