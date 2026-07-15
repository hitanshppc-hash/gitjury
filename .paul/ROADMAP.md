# GitJury Roadmap

Methodology: Paul (Plan-Apply-Unify Loop). Each phase = one focused capability, shipped and smoke-tested before moving on.

## v0.1 MVP (this build)

- [ ] **Phase 1 — Scaffold + design system**: Next.js app (done), dark "courtroom" theme tokens, base layout, brand.
- [ ] **Phase 2 — GitHub ingestion**: `lib/github.js` — parse URL(s), fetch metadata/tree/README/manifests/commit activity, rate-limit handling.
- [ ] **Phase 3 — AI judge engine**: `lib/rubric.js` + `lib/openrouter.js` — free-model discovery, fallback rotation, structured verdict prompt + robust JSON parsing, server-side score verification.
- [ ] **Phase 4 — Orchestration API**: `app/api/analyze` — batch input, bounded concurrency, per-repo error isolation, transparency metadata (model used, rubric version, timestamp).
- [ ] **Phase 5 — Dashboard UI**: no-auth root dashboard, multi-repo input, animated flashcard grid, verdict detail modal (radar + bar charts), leaderboard for batches, JSON download.
- [ ] **Phase 6 — Smoke test**: run against real public repos, verify end-to-end, fix issues found.

## v0.2+ (planned, not started)

- **History & caching**: lightweight SQLite store keyed by repo+commit SHA so re-judging is instant and free; avoids re-burning free-model rate limits.
- **PDF/print export**: polished printable report to complement the JSON download.
- **Deep scan mode**: optional shallow git clone + static analysis (complexity, lint, dependency vulnerability scan) for a "Pro" tier of judgment beyond API-only signals.
- **Private repos**: GitHub OAuth to judge private repos the user owns.
- **Compare view**: side-by-side diff of two repos' verdicts.
- **Auth (optional)**: only if saved history/accounts become a real need — explicitly deferred, not assumed.

## Decisions Log

- **2026-07-15**: Product named **GitJury**. Rubric locked at 7 categories summing to 100 (see PROJECT.md). Stack: Next.js single deployable, no separate backend service (unlike character-build-panel's Next+FastAPI split) — ingestion and judging are both I/O-bound API calls, no heavy compute that needs Python. No auth in v1 per explicit direction — dashboard is the entry point.
