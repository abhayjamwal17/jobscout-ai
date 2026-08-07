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
  services/       RemoteOK fetching, Telegram sending, job-digest formatting.
  types/          Shared TypeScript types (e.g. Job).
  utils/          Shared helper functions (e.g. Markdown escaping).
.github/workflows/  CI and scheduled-run pipelines.
memory/             Reserved for persisted agent state/history (empty for now).
```

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
