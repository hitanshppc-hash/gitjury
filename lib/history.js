const KEY = "gitjury_history_v1";
const MAX_ENTRIES = 40;

export function getHistory() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Merges freshly-judged results into history, newest-first, deduped by slug (latest wins). */
export function addToHistory(results) {
  if (typeof window === "undefined") return getHistory();
  const okResults = results.filter((r) => r.ok);
  if (!okResults.length) return getHistory();

  const existing = getHistory();
  const bySlug = new Map(existing.map((r) => [r.slug, r]));
  for (const r of okResults) bySlug.set(r.slug, r);

  const merged = [...bySlug.values()]
    .sort((a, b) => new Date(b.transparency?.judgedAt || 0) - new Date(a.transparency?.judgedAt || 0))
    .slice(0, MAX_ENTRIES);

  try {
    window.localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // storage full/unavailable — history just won't persist this round
  }
  return merged;
}

export function removeFromHistory(slug) {
  const next = getHistory().filter((r) => r.slug !== slug);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function clearHistory() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return [];
}
