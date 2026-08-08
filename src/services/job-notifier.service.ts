import type { Job } from '../types/job';
import { sendMessage } from './telegram.service';
import { escapeMarkdownV2 } from '../utils/markdown';
import { loadSeenJobs, hasSeen, markAsSeen, saveSeenJobs } from '../memory/memory.service';

const MAX_JOBS_IN_MESSAGE = 10;
const SEPARATOR = '━━━━━━━━━━━━';
const NO_JOBS_MESSAGE = 'No jobs found today.';
const NO_NEW_JOBS_MESSAGE = 'No new jobs since the last run.';

function formatJobsMessage(jobsToSend: Job[], totalNewCount: number): string {
  const lines: string[] = [
    '🤖 *JobScout AI*',
    '',
    escapeMarkdownV2(`Found ${totalNewCount} new remote job(s).`),
  ];

  for (const job of jobsToSend) {
    lines.push(SEPARATOR);
    lines.push(`🏢 *${escapeMarkdownV2(job.company)}*`);
    lines.push(`💼 ${escapeMarkdownV2(job.title)}`);
    lines.push(`📍 ${escapeMarkdownV2(job.location)}`);
    lines.push(`🔗 ${escapeMarkdownV2(job.url)}`);
  }
  lines.push(SEPARATOR);

  return lines.join('\n');
}

export async function sendJobsToTelegram(jobs: Job[]): Promise<void> {
  if (jobs.length === 0) {
    await sendMessage(NO_JOBS_MESSAGE);
    return;
  }

  await loadSeenJobs();

  const newJobs: Job[] = [];
  for (const job of jobs) {
    if (!(await hasSeen(job.id))) {
      newJobs.push(job);
    }
  }

  if (newJobs.length === 0) {
    console.log('[job-notifier] All fetched jobs were already seen; nothing new to notify.');
    await sendMessage(NO_NEW_JOBS_MESSAGE);
    return;
  }

  // Only the jobs that actually fit in the message are "sent". Any overflow
  // beyond MAX_JOBS_IN_MESSAGE is left unmarked so it gets included (and
  // marked seen) on a future run instead of being silently dropped forever.
  const jobsToSend = newJobs.slice(0, MAX_JOBS_IN_MESSAGE);
  const message = formatJobsMessage(jobsToSend, newJobs.length);

  try {
    await sendMessage(message, 'MarkdownV2');
  } catch (error) {
    console.error(
      'Failed to send job digest to Telegram:',
      error instanceof Error ? error.message : error,
    );
    // Don't mark jobs as seen if the notification never actually went out,
    // otherwise they'd be silently skipped on the next successful run.
    return;
  }

  for (const job of jobsToSend) {
    await markAsSeen(job.id);
  }
  await saveSeenJobs();
  console.log(`[job-notifier] Marked ${jobsToSend.length} job(s) as seen after successful notification.`);
}
