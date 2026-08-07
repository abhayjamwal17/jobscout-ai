import './config/env';
import { sendMessage } from './services/telegram.service';
import { fetchRemoteOkJobs } from './services/remoteok.service';
import { sendJobsToTelegram } from './services/job-notifier.service';

async function main(): Promise<void> {
  console.log('JobScout AI Started');
  await sendMessage('JobScout AI is online.');

  try {
    const jobs = await fetchRemoteOkJobs();
    await sendJobsToTelegram(jobs);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}

main();
