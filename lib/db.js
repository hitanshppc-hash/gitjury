import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// Uses Node's built-in SQLite (no native compile step, no extra dependency) as a
// cache keyed by repo + pushed_at — re-judging the same unchanged repo is then
// instant and burns zero GitHub/OpenRouter quota. A push updates pushed_at, which
// naturally invalidates the cache without us tracking commit SHAs.
//
// On Vercel (and most serverless hosts) the deployment filesystem is read-only and
// each invocation may land on a different container — there's no `./data` to write
// to. `/tmp` is writable and persists for the life of a warm container, so cache
// hits still work within/across nearby requests on the same instance; it just won't
// survive a cold start. Locally (and on a traditional Node host) we use a real
// project-relative file that persists indefinitely.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? "/tmp" : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "gitjury.db");

let db = null;

function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS verdicts (
      slug TEXT NOT NULL,
      pushed_at TEXT NOT NULL,
      judged_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (slug, pushed_at)
    )
  `);
  return db;
}

export function getCachedVerdict(slug, pushedAt) {
  try {
    const row = getDb()
      .prepare("SELECT payload, judged_at FROM verdicts WHERE slug = ? AND pushed_at = ?")
      .get(slug, pushedAt || "");
    if (!row) return null;
    return { ...JSON.parse(row.payload), cachedAt: row.judged_at };
  } catch {
    return null; // cache is best-effort — never let a cache failure break judging
  }
}

/** Latest verdict per repo, newest first — the admin dashboard's data source. The
 * verdicts table already doubles as an append-mostly analytics log: a repo only gets
 * a new row when it's re-judged after a push, so "latest per slug" is exactly the
 * current state of everything GitJury has ever judged. */
export function getAllVerdicts() {
  try {
    const rows = getDb()
      .prepare("SELECT slug, payload, judged_at FROM verdicts ORDER BY judged_at DESC")
      .all();
    const bySlug = new Map();
    for (const row of rows) {
      if (bySlug.has(row.slug)) continue; // first occurrence per slug = most recent (DESC order)
      try {
        bySlug.set(row.slug, { ...JSON.parse(row.payload), cachedAt: row.judged_at });
      } catch {
        /* skip corrupt row */
      }
    }
    return [...bySlug.values()];
  } catch {
    return [];
  }
}

export function setCachedVerdict(slug, pushedAt, result) {
  try {
    getDb()
      .prepare(
        `INSERT INTO verdicts (slug, pushed_at, judged_at, payload)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(slug, pushed_at) DO UPDATE SET judged_at = excluded.judged_at, payload = excluded.payload`,
      )
      .run(slug, pushedAt || "", new Date().toISOString(), JSON.stringify(result));
  } catch {
    // best-effort — a write failure just means no caching for this result, not a hard error
  }
}
