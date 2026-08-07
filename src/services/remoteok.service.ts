import axios, { isAxiosError } from 'axios';
import type { Job } from '../types/job';

const REMOTEOK_API_URL = 'https://remoteok.com/api';

/** Shape of a single job entry as returned by the RemoteOK API. */
interface RemoteOkJobRaw {
  id: string;
  slug?: string;
  position: string;
  company: string;
  location?: string;
  tags?: string[];
  url?: string;
  apply_url?: string;
  salary_min?: number | string;
  salary_max?: number | string;
  date?: string;
}

// The RemoteOK API prepends a non-job "legal notice" object to the array,
// so job entries are distinguished by having an id/position/company.
function isJobEntry(entry: unknown): entry is RemoteOkJobRaw {
  const candidate = entry as Partial<RemoteOkJobRaw>;
  return (
    typeof candidate?.id === 'string' &&
    typeof candidate?.position === 'string' &&
    typeof candidate?.company === 'string'
  );
}

function toNumberOrNull(value: number | string | undefined): number | null {
  if (value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function normalizeJob(raw: RemoteOkJobRaw): Job {
  return {
    id: raw.id,
    title: raw.position,
    company: raw.company,
    location: raw.location?.trim() || 'Remote',
    tags: raw.tags ?? [],
    url: raw.apply_url ?? raw.url ?? '',
    salaryMin: toNumberOrNull(raw.salary_min),
    salaryMax: toNumberOrNull(raw.salary_max),
    postedAt: raw.date ?? '',
    source: 'remoteok',
  };
}

export async function fetchRemoteOkJobs(): Promise<Job[]> {
  try {
    const response = await axios.get<unknown[]>(REMOTEOK_API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JobScoutAI/1.0)',
        Accept: 'application/json',
      },
      timeout: 10_000,
    });

    if (!Array.isArray(response.data)) {
      throw new Error('Unexpected RemoteOK response format: expected an array.');
    }

    return response.data.filter(isJobEntry).map(normalizeJob);
  } catch (error) {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      throw new Error(
        `Failed to fetch jobs from RemoteOK${status ? ` (HTTP ${status})` : ''}: ${error.message}`,
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch jobs from RemoteOK: ${message}`);
  }
}
