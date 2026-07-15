// Scans raw text (a .txt with one URL per line, a .csv with repo URLs in any column,
// or just pasted text) for github.com/owner/repo occurrences. This is deliberately
// permissive about the surrounding format — the only structure we require is that a
// GitHub URL appears somewhere on the line.
const GITHUB_URL_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?=[\s,"'\/>]|$)/gi;

export function extractRepoUrls(text) {
  const found = new Set();
  let m;
  const re = new RegExp(GITHUB_URL_RE.source, "gi");
  while ((m = re.exec(text))) {
    const owner = m[1];
    const repo = m[2];
    if (!owner || !repo) continue;
    if (["orgs", "topics", "sponsors", "marketplace", "settings"].includes(owner.toLowerCase())) continue;
    found.add(`https://github.com/${owner}/${repo}`);
  }
  return [...found];
}
