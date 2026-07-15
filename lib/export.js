export function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function cleanModelName(id) {
  return id ? id.replace(/:free$/i, "") : "";
}

/** Human-facing report — deliberately leaves out the raw per-attempt provider error
 * payloads (429s, timeouts, etc.). Those are internal routing noise, not something
 * someone judging a repo needs to see; a one-line summary is enough for transparency. */
export function buildReport(result) {
  const attempts = result.transparency?.modelAttempts || [];
  return {
    repo: result.slug,
    url: result.url,
    generatedBy: "GitJury",
    judgedAt: result.transparency?.judgedAt,
    judgedBy: cleanModelName(result.transparency?.modelUsed),
    modelsConsidered: attempts.length,
    rubric: result.transparency?.rubric,
    repoMeta: result.repoMeta,
    verdict: result.verdict,
  };
}

export function buildMarkdownReport(result) {
  const { verdict, slug, url, transparency } = result;
  const lines = [
    `# GitJury Verdict — ${slug}`,
    "",
    `**Score: ${verdict.overallScore}/100 — ${verdict.verdictTag}**`,
    "",
    verdict.summary,
    "",
    "## Category breakdown",
    ...Object.values(verdict.categories).map(
      (c) => `- **${c.label}**: ${c.score}/${c.max} — ${c.justification}`,
    ),
    "",
    "## Strengths",
    ...(verdict.strengths.length ? verdict.strengths.map((s) => `- ${s}`) : ["- None noted."]),
    "",
    "## Weaknesses",
    ...(verdict.weaknesses.length ? verdict.weaknesses.map((s) => `- ${s}`) : ["- None noted."]),
    "",
    "## Suggested improvements",
    ...(verdict.improvements.length
      ? verdict.improvements.map((i) => `- **[${i.priority}] ${i.title}** — ${i.detail}`)
      : ["- None noted."]),
    "",
    "## Current state",
    verdict.starterCodeAssessment || "—",
    "",
    "---",
    `Judged by GitJury (${cleanModelName(transparency?.modelUsed)}) on ${new Date(transparency?.judgedAt).toLocaleString()} · ${url}`,
  ];
  return lines.join("\n");
}

export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per judged repo — for batches too large to review card-by-card. */
export function buildCsvSummary(results) {
  const header = [
    "repo",
    "url",
    "ok",
    "score",
    "verdict_tag",
    "code_quality",
    "documentation",
    "architecture",
    "testing",
    "maintenance",
    "security",
    "completeness",
    "summary",
    "error",
  ];
  const rows = results.map((r) => {
    if (!r.ok) return [r.slug || r.input, "", "false", "", "", "", "", "", "", "", "", "", "", r.error];
    const c = r.verdict.categories;
    return [
      r.slug,
      r.url,
      "true",
      r.verdict.overallScore,
      r.verdict.verdictTag,
      c.code_quality?.score,
      c.documentation?.score,
      c.architecture?.score,
      c.testing?.score,
      c.maintenance?.score,
      c.security?.score,
      c.completeness?.score,
      r.verdict.summary,
      "",
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadCSV(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
