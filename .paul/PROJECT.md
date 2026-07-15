---
description: "A fair, transparent AI judge for GitHub repos — score, verdict, and actionable feedback in seconds"
type: Project
about: "gitjury"
---

# GitJury

## What This Is

**GitJury** is a SaaS that takes one or many GitHub repo links and acts as an impartial judge: it reads the repo (structure, code, docs, dependencies, activity signals), writes a short plain-English description of what the project actually is, and hands back a **0-100 score broken into transparent categories** — never a black-box number. Results render as animated flashcards; each card expands into a full verdict with graphs, strengths/weaknesses, concrete improvement suggestions, an assessment of the current starter/production state, and a downloadable report. Judging is powered exclusively by **free models on OpenRouter**, selected dynamically (not hardcoded) with fallback rotation so rate limits on one model don't break an analysis.

## Core Value

Anyone evaluating a repo — a hiring manager screening a candidate's portfolio, a maintainer triaging a PR/fork, a founder assessing a starter template, a dev judging their own project — gets a **fair, criteria-based, explainable verdict** instead of a vibe check. Every score ships with the evidence and rubric weight behind it. Batch mode lets you drop in several repos and get a sortable leaderboard.

## Current State

| Attribute | Value |
|-----------|-------|
| Type | Application (SaaS) |
| Version | 0.1.0 (MVP build in progress) |
| Status | Phase 1 in progress |
| Last Updated | 2026-07-15 |

## Requirements

### Core Features
- **Multi-input**: accepts a single GitHub URL or a batch (newline/comma separated, paste-many).
- **Repo ingestion**: GitHub REST API — metadata, full file tree, README, key manifests (package.json/requirements.txt/pyproject.toml/go.mod/Cargo.toml/pom.xml), language breakdown, recent commit activity. No cloning in v1 (serverless-friendly).
- **AI judge engine**: structured JSON verdict from a free OpenRouter model — summary, per-category scored rubric with justification + evidence, strengths, weaknesses, prioritized improvement suggestions, starter-code/production-readiness assessment, verdict tag.
- **Transparent scoring**: overall score is computed server-side as the sum of category scores (never trusts model arithmetic); rubric weights and the model used are always shown.
- **Flashcard results UI**: animated grid, color-coded score band, short description, mini category bars; click through to full verdict detail with radar + bar graphs.
- **Leaderboard/compare**: when multiple repos are judged in one batch, rank and compare them.
- **Download**: per-repo JSON report now; PDF/print-friendly export as a fast follow.
- **No auth in v1**: the dashboard *is* the app — no login gate. Auth can be added later if history/accounts are needed.

### Scoring Rubric (0-100, transparent, server-verified)
| Category | Weight |
|---|---|
| Code Quality & Structure | 20 |
| Documentation | 15 |
| Architecture & Design | 15 |
| Testing | 15 |
| Maintenance & Activity signals | 10 |
| Security & Best Practices | 10 |
| Completeness / Production-readiness | 15 |

### Out of Scope (v1)
- Auth/accounts, saved history, team workspaces — no DB in v1; stateless per-request analysis.
- Cloning repos / running static analysis tools locally (radon, eslint, etc.) — API-only ingestion for now; candidate for a later "deep scan" phase.
- Private repo support (requires OAuth) — public repos only in v1.
- Paid OpenRouter models — free-tier models only, by explicit user requirement.

## Target Users
Hiring managers/recruiters screening portfolios, open-source maintainers triaging forks/PRs, founders evaluating starter templates or acquisitions, developers wanting an honest read on their own repo before sharing it.

## Tech Stack
- **Frontend/Backend**: Next.js (App Router, single deployable) + Tailwind v4 + Framer Motion (animation) + Recharts (radar/bar graphs)
- **AI**: OpenRouter, free models only — discovered live from `/api/v1/models` filtered to `:free`/zero-priced, with fallback rotation
- **Repo data**: GitHub REST API (optionally authenticated via `GITHUB_TOKEN` for the 5000/hr limit instead of 60/hr)
- **Storage**: none in v1 (stateless); SQLite-backed history is a planned later phase
