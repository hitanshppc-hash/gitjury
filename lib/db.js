import { createClient } from "@libsql/client";
import path from "node:path";

// @libsql/client works identically against a local file (dev, no account needed) and
// a real Turso database (production) — same API either way. This replaced a local
// SQLite cache that worked fine in dev but silently produced empty admin analytics in
// production: on Vercel each request can land in a different serverless container with
// its own isolated /tmp, so a file-backed cache never actually accumulates data across
// requests there. Turso is a real network-reachable database, so it does.
//
// Falls back to a local file automatically if TURSO_DATABASE_URL isn't set, so local
// dev and any deploy target without Turso configured still work — just without
// cross-container persistence in that fallback case (same caveat as before).
const DB_PATH = path.join(process.cwd(), "data", "gitjury.db");

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${DB_PATH}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let ready = null;
function ensureSchema() {
  if (!ready) {
    ready = client.execute(`
      CREATE TABLE IF NOT EXISTS verdicts (
        slug TEXT NOT NULL,
        pushed_at TEXT NOT NULL,
        judged_at TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (slug, pushed_at)
      )
    `);
  }
  return ready;
}

export async function getCachedVerdict(slug, pushedAt) {
  try {
    await ensureSchema();
    const result = await client.execute({
      sql: "SELECT payload, judged_at FROM verdicts WHERE slug = ? AND pushed_at = ?",
      args: [slug, pushedAt || ""],
    });
    const row = result.rows[0];
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
export async function getAllVerdicts() {
  try {
    await ensureSchema();
    const result = await client.execute("SELECT slug, payload, judged_at FROM verdicts ORDER BY judged_at DESC");
    const bySlug = new Map();
    for (const row of result.rows) {
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

export async function setCachedVerdict(slug, pushedAt, result) {
  try {
    await ensureSchema();
    await client.execute({
      sql: `INSERT INTO verdicts (slug, pushed_at, judged_at, payload)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(slug, pushed_at) DO UPDATE SET judged_at = excluded.judged_at, payload = excluded.payload`,
      args: [slug, pushedAt || "", new Date().toISOString(), JSON.stringify(result)],
    });
  } catch {
    // best-effort — a write failure just means no caching for this result, not a hard error
  }
}
