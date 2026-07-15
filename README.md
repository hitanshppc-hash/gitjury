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

- `OPENROUTER_API_KEY` — required unless `GROQ_API_KEY` is set. Free at https://openrouter.ai/settings/keys
- `GROQ_API_KEY` — recommended. Dedicated free-tier provider, tried first (far less rate-limit
  contention than OpenRouter's shared free pool). Free at https://console.groq.com/keys
- `GITHUB_TOKEN` — optional but recommended. A classic PAT with no scopes raises the
  GitHub API limit from 60 requests/hour to 5000/hour. Needed for any serious batch size.
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — optional locally (falls back to a local SQLite
  file at `data/gitjury.db`), but required in production/serverless for the admin dashboard
  to work — see below. Free at https://turso.tech.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel, or run `vercel` from this directory.
2. Set all env vars above in the Vercel project settings (Settings → Environment Variables) —
   they are never committed (`.env*` is gitignored).
3. Serverless-specific things already handled in code, worth knowing about:
   - `app/api/analyze/route.js` sets `export const maxDuration = 60` since judging does
     real GitHub + OpenRouter/Groq I/O — the platform default (10s) isn't enough. 60s
     requires at least a Pro-tier Vercel plan for Node.js functions; check your plan.
   - `lib/db.js` uses `@libsql/client`, which talks to a real Turso database when
     `TURSO_DATABASE_URL` is set. This matters specifically because a plain local-file
     SQLite cache does **not** work correctly on Vercel: each request can land on a
     different serverless container with its own isolated filesystem, so a file-backed
     cache never actually accumulates data across requests there — the admin dashboard
     would silently show 0 for everything. Turso is a real network-reachable database,
     so results (and the analytics they feed) persist and aggregate correctly.
4. Large batches (hundreds to 1000+ repos, via file upload) are chunked client-side into
   small requests, so no single request needs to grow beyond `MAX_REPOS_PER_REQUEST` (10)
   regardless of batch size — this keeps every request well inside the function timeout.

## Architecture

See `.paul/PROJECT.md` and `.paul/ROADMAP.md` for the full product spec and phased plan.
