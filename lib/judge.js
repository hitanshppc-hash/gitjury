import { getFreeModels, callOpenRouterModel } from "@/lib/openrouter";
import { getGroqModels, callGroqModel, hasGroqKey } from "@/lib/groq";

const WAVE_SIZE = 12; // Groq's whole catalog plus a few OpenRouter models fits in one wave
const MAX_ATTEMPTS = 24;
const RECENT_SUCCESS_BOOST_MS = 10 * 60 * 1000;

// In-memory only (resets on cold start/restart) — a model that just worked in the last
// few minutes is worth trying first next time, since free-tier availability comes and
// goes in bursts. This is what makes repeat requests "go straight to what's responsive."
const recentSuccessAt = new Map();

function candidateKey(c) {
  return `${c.provider}/${c.id}`;
}

function withRecencyBoost(pool) {
  const now = Date.now();
  const isRecent = (c) => now - (recentSuccessAt.get(candidateKey(c)) || 0) < RECENT_SUCCESS_BOOST_MS;
  const recent = pool.filter(isRecent);
  const rest = pool.filter((c) => !isRecent(c));
  return [...recent, ...rest];
}

function callByProvider(candidate, args, signal) {
  return candidate.provider === "groq"
    ? callGroqModel(candidate.id, args, signal)
    : callOpenRouterModel(candidate.id, args, signal);
}

/**
 * Races an entire wave of candidates truly in parallel: as soon as one succeeds, every
 * other in-flight request is aborted immediately rather than waited-out. This is the
 * difference between "judging takes as long as the slowest model in the batch" and
 * "judging takes as long as the fastest model that actually answers."
 */
function raceWave(candidates, args) {
  return new Promise((resolve) => {
    if (!candidates.length) return resolve({ winner: null, attempts: [] });

    const controllers = candidates.map(() => new AbortController());
    const attempts = new Array(candidates.length);
    let settledCount = 0;
    let resolved = false;

    candidates.forEach((c, i) => {
      callByProvider(c, args, controllers[i].signal).then((r) => {
        attempts[i] = { model: c.id, provider: c.provider, ok: r.ok, error: r.error, status: r.status };
        if (r.ok && !resolved) {
          resolved = true;
          controllers.forEach((ctrl, j) => j !== i && ctrl.abort());
          recentSuccessAt.set(candidateKey(c), Date.now());
          resolve({ winner: { ...r, provider: c.provider }, attempts: attempts.filter(Boolean) });
        }
        settledCount++;
        if (settledCount === candidates.length && !resolved) {
          resolved = true;
          resolve({ winner: null, attempts: attempts.filter(Boolean) });
        }
      });
    });
  });
}

async function getCandidatePool() {
  const [groqModels, openRouterModels] = await Promise.all([
    getGroqModels().catch(() => []),
    getFreeModels().catch(() => []),
  ]);
  return withRecencyBoost([...groqModels, ...openRouterModels]);
}

export async function judgeWithFallback({ systemPrompt, userPrompt, maxAttempts = MAX_ATTEMPTS }) {
  const pool = (await getCandidatePool()).slice(0, maxAttempts);
  if (!pool.length) {
    throw new Error(
      hasGroqKey()
        ? "No free models currently available from Groq or OpenRouter."
        : "No free OpenRouter models currently available (add GROQ_API_KEY for a second, less contended provider).",
    );
  }

  const attempts = [];
  for (let i = 0; i < pool.length; i += WAVE_SIZE) {
    const wave = pool.slice(i, i + WAVE_SIZE);
    const { winner, attempts: waveAttempts } = await raceWave(wave, { systemPrompt, userPrompt });
    attempts.push(...waveAttempts);
    if (winner) return { ...winner, attempts };
  }

  const err = new Error(
    `All ${attempts.length} model attempts failed: ${attempts.map((a) => `${a.provider}/${a.model} (${a.error})`).join("; ")}`,
  );
  err.attempts = attempts;
  throw err;
}
