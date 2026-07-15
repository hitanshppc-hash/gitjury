# GitJury

The fair judge for your GitHub repo. Paste one repo or a whole batch, get a transparent,
rubric-scored verdict — what it is, what it scores per category, strengths/weaknesses,
concrete improvement suggestions, and a downloadable report.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.local.example` to `.env.local` (or edit `.env.local` directly) and set:

- `OPENROUTER_API_KEY` — required. Get one free at https://openrouter.ai/settings/keys
- `GITHUB_TOKEN` — optional but recommended. A classic PAT with no scopes raises the
  GitHub API limit from 60 requests/hour to 5000/hour. Needed for any serious batch size.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel, or run `vercel` from this directory.
2. Set the same two env vars (`OPENROUTER_API_KEY`, `GITHUB_TOKEN`) in the Vercel project
   settings — they are never committed (`.env*` is gitignored).
3. Two serverless-specific things are already handled in code, worth knowing about:
   - `app/api/analyze/route.js` sets `export const maxDuration = 60` since judging does
     real GitHub + OpenRouter I/O with retries — the platform default (10s) isn't enough.
     60s requires at least a Pro-tier Vercel plan for Node.js functions; check your plan.
   - `lib/db.js` (the SQLite result cache) writes to `/tmp` when `process.env.VERCEL` is
     set, since the deployment filesystem is otherwise read-only and non-persistent.
     Cache hits still work within/across nearby requests on a warm container, but reset
     on cold start — this is a soft optimization, not something the app depends on.
4. Large batches (hundreds to 1000+ repos, via file upload) are chunked client-side into
   small requests, so no single request needs to grow beyond `MAX_REPOS_PER_REQUEST` (10)
   regardless of batch size — this keeps every request well inside the function timeout.

## Architecture

See `.paul/PROJECT.md` and `.paul/ROADMAP.md` for the full product spec and phased plan.
