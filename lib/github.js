const API = "https://api.github.com";

// Manifest/config files we look for and, when present, pull a truncated excerpt of —
// these are the strongest single-file signals for stack, deps, and project maturity.
const MANIFEST_CANDIDATES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "Gemfile",
  "composer.json",
  "Dockerfile",
  "docker-compose.yml",
  ".github/workflows",
];

const TEST_DIR_HINTS = ["test", "tests", "__tests__", "spec", "cypress", "e2e"];

export class GitHubError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.detail = detail;
  }
}

export function parseRepoUrl(input) {
  const raw = input.trim();
  if (!raw) return null;

  let s = raw.replace(/^git@github\.com:/, "https://github.com/");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;

  let url;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  if (!owner || !repo) return null;

  return { owner, repo, slug: `${owner}/${repo}` };
}

function authHeaders() {
  const token = process.env.GITHUB_TOKEN;
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function gh(path) {
  const res = await fetch(`${API}${path}`, { headers: authHeaders(), cache: "no-store" });
  if (res.status === 404) throw new GitHubError("Repository not found (or private).", 404);
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    if (remaining === "0") {
      const resetDate = reset ? new Date(Number(reset) * 1000) : null;
      throw new GitHubError(
        `GitHub API rate limit hit${resetDate ? ` (resets ${resetDate.toLocaleTimeString()})` : ""}. Add a GITHUB_TOKEN to raise the limit from 60/hr to 5000/hr.`,
        403,
      );
    }
    throw new GitHubError("GitHub API access forbidden.", 403);
  }
  if (!res.ok) throw new GitHubError(`GitHub API error (${res.status})`, res.status);
  return res.json();
}

function decodeBase64Content(content) {
  if (!content) return "";
  try {
    return Buffer.from(content, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max)}\n… [truncated]` : str;
}

/** Single cheap call — just enough (incl. pushed_at) to make a cache-hit/miss decision
 * before paying for the full digest fetch (languages/readme/commits/tree). */
export async function fetchRepoMeta({ owner, repo }) {
  return gh(`/repos/${owner}/${repo}`);
}

/** Fetches everything the judge needs about a repo via the REST API only (no cloning).
 * Pass an already-fetched `meta` (from fetchRepoMeta) to avoid refetching it. */
export async function fetchRepoDigest({ owner, repo }, prefetchedMeta) {
  const meta = prefetchedMeta || (await gh(`/repos/${owner}/${repo}`));

  const [languages, readme, commits, tree] = await Promise.all([
    gh(`/repos/${owner}/${repo}/languages`).catch(() => ({})),
    gh(`/repos/${owner}/${repo}/readme`).catch(() => null),
    gh(`/repos/${owner}/${repo}/commits?per_page=10`).catch(() => []),
    gh(`/repos/${owner}/${repo}/git/trees/${meta.default_branch}?recursive=1`).catch(() => null),
  ]);

  const allPaths = (tree?.tree || [])
    .filter((t) => t.type === "blob")
    .map((t) => t.path);
  const truncatedTree = tree?.truncated ?? false;

  const hasTests = allPaths.some((p) =>
    TEST_DIR_HINTS.some((hint) => new RegExp(`(^|/)${hint}(/|$)`, "i").test(p)),
  );
  const hasCI = allPaths.some((p) => p.startsWith(".github/workflows/"));

  const foundManifests = MANIFEST_CANDIDATES.filter((m) =>
    allPaths.some((p) => p === m || p.startsWith(`${m}/`)),
  );

  const manifestExcerpts = {};
  const filesToFetch = foundManifests.filter((m) => !m.endsWith("/") && m !== ".github/workflows").slice(0, 6);
  await Promise.all(
    filesToFetch.map(async (path) => {
      try {
        const file = await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`);
        if (file && !Array.isArray(file) && file.content) {
          manifestExcerpts[path] = truncate(decodeBase64Content(file.content), 2500);
        }
      } catch {
        // best-effort — a missing/unreadable manifest just gets omitted
      }
    }),
  );

  const readmeText = readme ? truncate(decodeBase64Content(readme.content), 8000) : "";

  const recentCommits = (commits || []).slice(0, 10).map((c) => ({
    sha: c.sha?.slice(0, 7),
    message: (c.commit?.message || "").split("\n")[0],
    date: c.commit?.author?.date,
    author: c.commit?.author?.name,
  }));

  const lastPushDaysAgo = meta.pushed_at
    ? Math.round((Date.now() - new Date(meta.pushed_at).getTime()) / 86_400_000)
    : null;

  return {
    slug: `${owner}/${repo}`,
    url: meta.html_url,
    description: meta.description,
    stars: meta.stargazers_count,
    forks: meta.forks_count,
    openIssues: meta.open_issues_count,
    license: meta.license?.spdx_id || null,
    topics: meta.topics || [],
    createdAt: meta.created_at,
    pushedAt: meta.pushed_at,
    lastPushDaysAgo,
    defaultBranch: meta.default_branch,
    sizeKb: meta.size,
    archived: meta.archived,
    languages,
    fileCount: allPaths.length,
    treeTruncated: truncatedTree,
    filePaths: allPaths.slice(0, 800),
    hasTests,
    hasCI,
    foundManifests,
    manifestExcerpts,
    readme: readmeText,
    hasReadme: Boolean(readme),
    recentCommits,
  };
}

/** Compact plain-text digest fed to the LLM — keeps token usage sane on free models. */
export function digestToPromptText(d) {
  const langLines = Object.entries(d.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([lang, bytes]) => `${lang}: ${bytes}`)
    .join(", ");

  const manifestBlock = Object.entries(d.manifestExcerpts)
    .map(([path, content]) => `--- ${path} ---\n${content}`)
    .join("\n\n");

  const treeSample = d.filePaths.slice(0, 400).join("\n");

  return `
REPO: ${d.slug}
URL: ${d.url}
DESCRIPTION (author-provided): ${d.description || "(none)"}
STARS: ${d.stars} | FORKS: ${d.forks} | OPEN ISSUES: ${d.openIssues}
LICENSE: ${d.license || "none"}
TOPICS: ${d.topics.join(", ") || "none"}
CREATED: ${d.createdAt} | LAST PUSH: ${d.pushedAt} (${d.lastPushDaysAgo} days ago) | ARCHIVED: ${d.archived}
FILE COUNT: ${d.fileCount}${d.treeTruncated ? " (tree truncated by GitHub API, large repo)" : ""}
HAS TEST DIRECTORY: ${d.hasTests} | HAS CI (GitHub Actions): ${d.hasCI} | HAS README: ${d.hasReadme}
LANGUAGES (bytes): ${langLines || "unknown"}

RECENT COMMITS:
${d.recentCommits.map((c) => `- ${c.date?.slice(0, 10)} ${c.sha} ${c.message}`).join("\n") || "(none found)"}

FILE TREE (sample, up to 400 paths):
${treeSample || "(unavailable)"}

MANIFEST / CONFIG FILE EXCERPTS:
${manifestBlock || "(none found)"}

README (truncated):
${d.readme || "(no README found)"}
`.trim();
}
