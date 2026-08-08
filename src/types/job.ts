export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  tags: string[];
  url: string;
  salaryMin: number | null;
  salaryMax: number | null;
  postedAt: string;
  source: string;
  /** Plain-text job posting body (HTML stripped). Empty string if the source didn't provide one. */
  description: string;
}
