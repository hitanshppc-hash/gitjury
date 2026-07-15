export const RUBRIC = [
  {
    key: "code_quality",
    label: "Code Quality & Structure",
    max: 20,
    hint: "Readability, naming, consistency, module boundaries, obvious anti-patterns, duplication.",
  },
  {
    key: "documentation",
    label: "Documentation",
    max: 15,
    hint: "README clarity, setup/usage instructions, inline docs where non-obvious logic needs them.",
  },
  {
    key: "architecture",
    label: "Architecture & Design",
    max: 15,
    hint: "Separation of concerns, sensible layering, dependency choices, scalability of the design.",
  },
  {
    key: "testing",
    label: "Testing",
    max: 15,
    hint: "Presence and apparent coverage of tests, CI wiring, whether tests look meaningful vs. token.",
  },
  {
    key: "maintenance",
    label: "Maintenance & Activity",
    max: 10,
    hint: "Recency and quality of commits, issue hygiene, whether the repo looks alive or abandoned.",
  },
  {
    key: "security",
    label: "Security & Best Practices",
    max: 10,
    hint: "Secret handling, dependency hygiene, obvious unsafe patterns, license clarity.",
  },
  {
    key: "completeness",
    label: "Completeness / Production-readiness",
    max: 15,
    hint: "How close this is to a finished, deployable product vs. a starter/skeleton/experiment.",
  },
];

export const RUBRIC_MAX_TOTAL = RUBRIC.reduce((sum, c) => sum + c.max, 0); // 100

// Fixed taxonomy (rather than free-text) so the admin dashboard can group/chart by
// track reliably — an open-ended category field would fragment into near-duplicates
// ("Health", "Healthcare", "Medical") and make aggregation useless.
export const TRACKS = [
  "Healthcare",
  "FinTech",
  "Security & Privacy",
  "Developer Tools",
  "Data / AI / ML",
  "E-commerce",
  "Gaming",
  "Education",
  "Social & Community",
  "Productivity & Collaboration",
  "Infrastructure & DevOps",
  "Web / Mobile App",
  "Other",
];

function trackOrOther(track) {
  return TRACKS.includes(track) ? track : "Other";
}

const VERDICT_TAGS = [
  "Production-Ready",
  "Strong MVP",
  "Solid Prototype",
  "Early Stage",
  "Needs Significant Work",
];

function tagForScore(score) {
  if (score >= 85) return "Production-Ready";
  if (score >= 65) return "Strong MVP";
  if (score >= 45) return "Solid Prototype";
  if (score >= 25) return "Early Stage";
  return "Needs Significant Work";
}

export function buildJudgePrompt(digestText) {
  const rubricSpec = RUBRIC.map((c) => `- "${c.key}" (max ${c.max}): ${c.label} — ${c.hint}`).join("\n");

  const systemPrompt = `You are GitJury, an impartial, rigorous judge of GitHub repositories. You evaluate strictly on evidence present in the provided repo data — never assume features you cannot see. Be fair but honest: do not inflate scores to be nice, and do not punish a repo for being an intentionally small/early-stage project if it does what it does well. Always ground every score in specific evidence from the digest. You respond with ONLY a single valid JSON object, no prose outside it, matching the exact schema requested.`;

  const userPrompt = `Judge this GitHub repository using the rubric below. Score each category independently on its own scale (do not think about the 0-100 total, just score each category on ITS max). Also classify the project into exactly one track from this fixed list, choosing whichever fits best even if imperfectly: ${TRACKS.join(", ")}.

RUBRIC:
${rubricSpec}

Respond with ONLY this JSON shape (no markdown fences, no commentary):
{
  "summary": "2-3 plain-English sentences describing what this project actually is and does",
  "track": "<one of: ${TRACKS.join(" | ")}>",
  "categories": {
${RUBRIC.map((c) => `    "${c.key}": { "score": <0-${c.max} integer>, "justification": "<1-2 sentences>", "evidence": ["<short evidence bullet>", "..."] }`).join(",\n")}
  },
  "strengths": ["<short bullet>", "..."],
  "weaknesses": ["<short bullet>", "..."],
  "improvements": [
    { "title": "<short actionable title>", "detail": "<1-2 sentences>", "priority": "high" | "medium" | "low" }
  ],
  "starter_code_assessment": "1-3 sentences on the current state: is this a skeleton, an MVP, a mature product? What would it take to move it forward?"
}

REPO DATA:
${digestText}`;

  return { systemPrompt, userPrompt };
}

/** Clamps/repairs whatever the model returned into a trustworthy shape, and computes
 * the overall score server-side so we never just trust the model's own arithmetic. */
export function normalizeVerdict(parsed) {
  if (!parsed || typeof parsed !== "object") throw new Error("Empty verdict from model");

  const categories = {};
  let overall = 0;
  for (const c of RUBRIC) {
    const raw = parsed.categories?.[c.key];
    const score = Math.max(0, Math.min(c.max, Math.round(Number(raw?.score) || 0)));
    overall += score;
    categories[c.key] = {
      label: c.label,
      max: c.max,
      score,
      justification: typeof raw?.justification === "string" ? raw.justification : "",
      evidence: Array.isArray(raw?.evidence) ? raw.evidence.filter((e) => typeof e === "string").slice(0, 5) : [],
    };
  }

  const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.filter((s) => typeof s === "string").slice(0, 8) : [];
  const weaknesses = Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter((s) => typeof s === "string").slice(0, 8) : [];
  const improvements = Array.isArray(parsed.improvements)
    ? parsed.improvements
        .filter((i) => i && typeof i.title === "string")
        .map((i) => ({
          title: i.title,
          detail: typeof i.detail === "string" ? i.detail : "",
          priority: ["high", "medium", "low"].includes(i.priority) ? i.priority : "medium",
        }))
        .slice(0, 10)
    : [];

  return {
    summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : "No summary returned.",
    track: trackOrOther(parsed.track),
    overallScore: overall,
    verdictTag: tagForScore(overall),
    categories,
    strengths,
    weaknesses,
    improvements,
    starterCodeAssessment:
      typeof parsed.starter_code_assessment === "string" ? parsed.starter_code_assessment.trim() : "",
  };
}

export { VERDICT_TAGS };
