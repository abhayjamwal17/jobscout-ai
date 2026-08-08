import './config/env';
import { fetchRemoteOkJobs } from './services/remoteok.service';
import { loadResumeProfile } from './services/resume.service';
import { matchJobToResume } from './services/ai-matcher.service';

// TEMPORARY: manual test harness for the Milestone 6 AI matcher. Fetches one
// job, loads the resume profile, and prints the structured match result.
// Not wired into the Telegram digest yet — see job-notifier.service.ts for that.
async function main(): Promise<void> {
  console.log('JobScout AI Started (AI matcher test run)');

  try {
    const jobs = await fetchRemoteOkJobs();
    const [job] = jobs;
    if (!job) {
      console.log('No jobs returned from RemoteOK; nothing to match.');
      return;
    }

    const resume = await loadResumeProfile();

    console.log(`\nMatching "${job.title}" @ ${job.company} against resume for ${resume.name}...\n`);
    const result = await matchJobToResume(job, resume);

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
}

main();
