# JobScout AI

An automated job-search assistant. This repository currently contains only the
project scaffold — no business logic has been implemented yet.

## Requirements

- Node.js 20+
- npm

## Setup

```bash
npm install
cp .env.example .env
```

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
  index.ts        Entry point.
  config/         Environment/config loading.
  services/       External integrations and business logic (empty for now).
  types/          Shared TypeScript types (empty for now).
  utils/          Shared helper functions (empty for now).
.github/workflows/  CI pipelines.
memory/             Reserved for persisted agent state/history (empty for now).
```

## Environment variables

Copy `.env.example` to `.env` and fill in values as needed. `.env` is
git-ignored and loaded automatically at startup via `dotenv`.
