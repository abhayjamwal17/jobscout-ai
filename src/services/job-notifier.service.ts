import type { Job } from '../types/job';
import { sendMessage } from './telegram.service';
import { escapeMarkdownV2 } from '../utils/markdown';

const MAX_JOBS_IN_MESSAGE = 10;
const SEPARATOR = '━━━━━━━━━━━━';
const NO_JOBS_MESSAGE = 'No jobs found today.';

function formatJobsMessage(jobs: Job[]): string {
  const jobsToSend = jobs.slice(0, MAX_JOBS_IN_MESSAGE);

  const lines: string[] = [
    '🤖 *JobScout AI*',
    '',
    escapeMarkdownV2(`Found ${jobs.length} remote jobs.`),
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
  const message = jobs.length === 0 ? NO_JOBS_MESSAGE : formatJobsMessage(jobs);

  try {
    await sendMessage(message, 'MarkdownV2');
  } catch (error) {
    console.error(
      'Failed to send job digest to Telegram:',
      error instanceof Error ? error.message : error,
    );
  }
}
