# JobScout AI

An automated job-search assistant. It fetches remote job listings from
RemoteOK and sends a formatted digest of the newest ones to a Telegram chat.

## Requirements

- Node.js 20+
- npm

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env` (see
[Environment variables](#environment-variables) below).

## Scripts

| Command         | Description                                              |
| --------------- | ---------------------------------------------------------- |
| `npm run dev`   | Run `src/index.ts` directly with hot reload (via `tsx`).   |
| `npm run build` | Type-check and compile TypeScript from `src/` to `dist/`.  |
| `npm run start` | Run the compiled JavaScript in `dist/` with Node.        |
| `npm run lint`  | Run ESLint over the project.                              |

## Project structure

```
src/
  index.ts        Entry point: fetches jobs and sends the digest to Telegram.
  config/         Environment/config loading.
  services/       RemoteOK fetching, Telegram sending, job-digest formatting,
                  seen-job memory, resume profile loading/saving.
  types/          Shared TypeScript types (e.g. Job, ResumeProfile).
  utils/          Shared helper functions (e.g. Markdown escaping).
.github/workflows/  CI and scheduled-run pipelines.
memory/             Persisted agent state: seen-jobs.json (dedup history,
                    committed by the daily workflow) and resume.json
                    (structured resume profile, see below).
```

## Resume profile

JobScout AI reasons about jobs against a structured **resume profile** —
your resume's content parsed into a typed shape, not a raw PDF/DOCX. This
lets future matching logic (not implemented yet) compare job postings
against your skills, experience, and preferences programmatically.

- **Type definition:** `src/types/resume.ts` (`ResumeProfile`).
- **Read/write service:** `src/services/resume.service.ts`
  (`loadResumeProfile()`, `saveResumeProfile(profile)`).
- **Storage location:** `memory/resume.json`, committed to the repo like
  `memory/seen-jobs.json` — it's structured data you control, not a secret.
- **The original resume file** (PDF/DOCX) should go in the git-ignored
  `resume/` folder, never committed. Only the structured JSON derived from
  it lives in git.

### `ResumeProfile` shape

| Field                  | Type                       | Notes                                    |
| ----------------------- | --------------------------- | ----------------------------------------- |
| `name`                 | `string`                   |                                           |
| `professionalSummary`  | `string`                   |                                           |
| `education`            | `EducationEntry[]`         | see below                                |
| `targetRoles`          | `string[]`                 | roles you're looking for                 |
| `skills`               | `string[]`                 | general skills                           |
| `technicalSkills`      | `string[]`                 |                                           |
| `analyticalSkills`     | `string[]`                 |                                           |
| `productSkills`        | `string[]`                 |                                           |
| `tools`                | `string[]`                 |                                           |
| `programmingLanguages` | `string[]`                 |                                           |
| `workExperience`       | `WorkExperienceEntry[]`    | see below                                |
| `projects`             | `string[]`                 |                                           |
| `certifications`       | `string[]`                 |                                           |
| `industries`           | `string[]`                 |                                           |
| `yearsOfExperience`    | `number`                   | non-negative                             |
| `preferredWorkType`    | `'remote' \| 'hybrid' \| 'onsite' \| 'any'` |                             |

`EducationEntry`: `institution`, `degree`, `field`, `startYear` (`number`),
`endYear` (`number | null` — `null` means in progress).

`WorkExperienceEntry`: `company`, `role`, `duration` (free-form string, e.g.
`"Jan 2022 - Present"`), `responsibilities` (`string[]`), `achievements`
(`string[]`), `skills` (`string[]`).

### Creating your resume profile

There's no PDF importer yet (that's a future milestone) — for now, create
`memory/resume.json` by hand, matching the shape above, or write a small
script that calls `saveResumeProfile()` with a `ResumeProfile` object.
`saveResumeProfile()` validates the shape before writing, and
`loadResumeProfile()` validates again on read, so a malformed file is
caught early with a specific list of what's wrong rather than failing
somewhere downstream. If `memory/resume.json` doesn't exist yet,
`loadResumeProfile()` throws a clear error telling you to create one first
— it does not silently fall back to an empty profile, since an agent
"understanding" a resume with no skills or experience would be worse than
an explicit failure.

## Environment variables

Copy `.env.example` to `.env` and fill in values as needed. `.env` is
git-ignored and loaded automatically at startup via `dotenv`.

| Variable             | Description                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`  | Bot token from [@BotFather](https://t.me/BotFather).                |
| `TELEGRAM_CHAT_ID`    | ID of the chat/user/group/channel the bot should message.           |

## GitHub Actions

### CI (`.github/workflows/ci.yml`)

Runs on every push/PR to `main`: installs dependencies, lints, and builds.
Requires no secrets.

### Daily job digest (`.github/workflows/daily.yml`)

Fetches jobs and sends the Telegram digest automatically every day at
**9:00 AM IST** (`30 3 * * *` UTC), and can also be triggered manually.

**1. Configure the required secrets**

The workflow needs the same two variables as your local `.env`, stored as
GitHub Actions secrets (never commit real tokens to the repo):

1. Go to the repository's **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** and add:
   - `TELEGRAM_BOT_TOKEN` — your bot's token from @BotFather.
   - `TELEGRAM_CHAT_ID` — the target chat ID.

If either secret is missing, the workflow fails immediately with a clear
error instead of running.

**2. Run it manually**

Go to the **Actions** tab → **Daily Job Digest** workflow → **Run workflow**.

**3. Automatic schedule**

Once the secrets are configured, no further setup is needed — GitHub Actions
will run the workflow automatically every day at the scheduled time. Note
that scheduled workflows can be delayed by a few minutes during periods of
high GitHub Actions load.
