import { NextResponse } from "next/server";
import { parseRepoUrl, fetchRepoMeta, fetchRepoDigest, digestToPromptText, GitHubError } from "@/lib/github";
import { judgeWithFallback } from "@/lib/judge";
import { buildJudgePrompt, normalizeVerdict, RUBRIC } from "@/lib/rubric";
import { getCachedVerdict, setCachedVerdict } from "@/lib/db";

// Route segment config: this endpoint does real work (GitHub + OpenRouter calls with
// retries), so it needs more than Vercel's default 10s. 60s requires at least the Pro
// plan for Node.js functions (Hobby is capped at 60s too as of Fluid Compute, but confirm
// against your plan) — MAX_REPOS_PER_REQUEST is deliberately small so a single request
// comfortably finishes within that budget; large batches are chunked client-side instead
// of raising this number.
export const maxDuration = 60;

const MAX_REPOS_PER_REQUEST = 10;
const CONCURRENCY = 5;

async function judgeOne(input, { forceRefresh = false } = {}) {
  const base = { input };
  const parsed = parseRepoUrl(input);
  if (!parsed) {
    return { ...base, ok: false, error: `Not a valid GitHub repo URL: "${input}"` };
  }

  try {
    const meta = await fetchRepoMeta(parsed);

    if (!forceRefresh) {
      const cached = getCachedVerdict(parsed.slug, meta.pushed_at);
      if (cached) return { ...base, ...cached, fromCache: true };
    }

    const digest = await fetchRepoDigest(parsed, meta);
    const promptText = digestToPromptText(digest);
    const { systemPrompt, userPrompt } = buildJudgePrompt(promptText);

    const result = await judgeWithFallback({ systemPrompt, userPrompt });
    const verdict = normalizeVerdict(result.parsed);

    const judged = {
      ok: true,
      slug: digest.slug,
      url: digest.url,
      repoMeta: {
        description: digest.description,
        stars: digest.stars,
        forks: digest.forks,
        openIssues: digest.openIssues,
        license: digest.license,
        topics: digest.topics,
        lastPushDaysAgo: digest.lastPushDaysAgo,
        languages: digest.languages,
        hasTests: digest.hasTests,
        hasCI: digest.hasCI,
        fileCount: digest.fileCount,
      },
      verdict,
      transparency: {
        modelUsed: result.modelId,
        modelProvider: result.provider,
        modelAttempts: result.attempts,
        judgedAt: new Date().toISOString(),
        rubric: RUBRIC,
      },
    };

    setCachedVerdict(digest.slug, meta.pushed_at, judged);
    return { ...base, ...judged };
  } catch (err) {
    const isGh = err instanceof GitHubError;
    return {
      ...base,
      ok: false,
      slug: parsed.slug,
      error: err.message || "Unknown error while judging this repo.",
      status: isGh ? err.status : undefined,
    };
  }
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function next() {
    const i = cursor++;
    if (i >= items.length) return;
    results[i] = await worker(items[i], i);
    await next();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

export async function POST(request) {
  if (!process.env.OPENROUTER_API_KEY && !process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing OPENROUTER_API_KEY and/or GROQ_API_KEY. Add at least one to .env.local and restart." },
      { status: 500 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const repoUrls = Array.isArray(body?.repoUrls) ? body.repoUrls.map((s) => String(s).trim()).filter(Boolean) : [];
  const unique = [...new Set(repoUrls)];
  const forceRefresh = Boolean(body?.forceRefresh);

  if (unique.length === 0) {
    return NextResponse.json({ error: "Provide at least one GitHub repo URL." }, { status: 400 });
  }
  if (unique.length > MAX_REPOS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Too many repos in one batch (max ${MAX_REPOS_PER_REQUEST}).` },
      { status: 400 },
    );
  }

  const results = await runWithConcurrency(unique, CONCURRENCY, (u) => judgeOne(u, { forceRefresh }));

  return NextResponse.json({ results });
}
