import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

// Resolved relative to this file (not process.cwd()) so the location is the
// same whether the app runs via `tsx src/...` or the compiled `dist/...`,
// regardless of the directory the process was launched from.
const MEMORY_DIR = path.resolve(__dirname, '../../memory');
const SEEN_JOBS_FILE = path.join(MEMORY_DIR, 'seen-jobs.json');

const LOG_PREFIX = '[memory.service]';

// Module-level cache: the process handles one run of the job digest at a
// time, so a single in-memory Set is enough to avoid re-reading the file for
// every hasSeen()/markAsSeen() call while still exposing load/save for
// callers that want explicit control over when disk I/O happens.
let seenJobIdsCache: Set<string> | null = null;

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * Reads memory/seen-jobs.json and returns the set of previously seen job
 * ids, populating the in-memory cache used by hasSeen()/markAsSeen().
 *
 * Never throws: a missing file is created automatically, and an empty or
 * corrupted file is treated as "no history yet" rather than crashing the
 * app, since losing dedup history is far less harmful than the whole
 * digest run failing.
 */
export async function loadSeenJobs(): Promise<Set<string>> {
  await mkdir(MEMORY_DIR, { recursive: true });

  let raw: string;
  try {
    raw = await readFile(SEEN_JOBS_FILE, 'utf-8');
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      console.log(`${LOG_PREFIX} No memory file found at ${SEEN_JOBS_FILE}. Creating a new one.`);
      seenJobIdsCache = new Set();
      await saveSeenJobs(seenJobIdsCache);
      return seenJobIdsCache;
    }
    console.error(
      `${LOG_PREFIX} Failed to read ${SEEN_JOBS_FILE}, starting with empty history:`,
      error instanceof Error ? error.message : error,
    );
    seenJobIdsCache = new Set();
    return seenJobIdsCache;
  }

  if (!raw.trim()) {
    console.warn(`${LOG_PREFIX} ${SEEN_JOBS_FILE} is empty. Starting with empty history.`);
    seenJobIdsCache = new Set();
    return seenJobIdsCache;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStringArray(parsed)) {
      console.warn(
        `${LOG_PREFIX} ${SEEN_JOBS_FILE} did not contain a JSON array of job id strings. ` +
          'Ignoring its contents and starting with empty history.',
      );
      seenJobIdsCache = new Set();
      return seenJobIdsCache;
    }
    seenJobIdsCache = new Set(parsed);
    console.log(`${LOG_PREFIX} Loaded ${seenJobIdsCache.size} previously seen job id(s).`);
    return seenJobIdsCache;
  } catch (error) {
    console.error(
      `${LOG_PREFIX} ${SEEN_JOBS_FILE} contains invalid JSON, starting with empty history:`,
      error instanceof Error ? error.message : error,
    );
    seenJobIdsCache = new Set();
    return seenJobIdsCache;
  }
}

/**
 * Persists the seen-job ids to memory/seen-jobs.json as a JSON array.
 *
 * Defaults to the current in-memory cache (built up via markAsSeen()) so
 * callers can simply call `saveSeenJobs()` once after marking jobs seen,
 * instead of threading a Set through the caller. An explicit Set can still
 * be passed for tests or one-off writes.
 */
export async function saveSeenJobs(seenJobs?: Set<string>): Promise<void> {
  const toPersist = seenJobs ?? seenJobIdsCache ?? new Set<string>();
  seenJobIdsCache = toPersist;

  try {
    await mkdir(MEMORY_DIR, { recursive: true });
    await writeFile(SEEN_JOBS_FILE, JSON.stringify([...toPersist], null, 2), 'utf-8');
    console.log(`${LOG_PREFIX} Saved ${toPersist.size} seen job id(s) to ${SEEN_JOBS_FILE}.`);
  } catch (error) {
    // Swallow the error: failing to persist dedup history shouldn't crash a
    // run that otherwise succeeded in notifying about jobs. Worst case,
    // some jobs get re-sent on the next run.
    console.error(
      `${LOG_PREFIX} Failed to write ${SEEN_JOBS_FILE}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

async function getSeenJobIds(): Promise<Set<string>> {
  if (seenJobIdsCache) return seenJobIdsCache;
  return loadSeenJobs();
}

/** Lazily loads the memory file on first use if loadSeenJobs() wasn't called yet. */
export async function hasSeen(jobId: string): Promise<boolean> {
  const seenJobIds = await getSeenJobIds();
  return seenJobIds.has(jobId);
}

/**
 * Marks a job id as seen in memory only (does not write to disk). Callers
 * that mark many jobs in a loop should call saveSeenJobs() once afterwards
 * rather than on every markAsSeen() call, to avoid one disk write per job.
 */
export async function markAsSeen(jobId: string): Promise<void> {
  const seenJobIds = await getSeenJobIds();
  seenJobIds.add(jobId);
}
