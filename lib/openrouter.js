const API = "https://openrouter.ai/api/v1";
const MODELS_CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;

// Preferred order when multiple free models are available — biggest/most-capable
// free-tier models first, since judging quality matters more than speed here.
// This is a soft preference only: whatever OpenRouter currently lists as free wins,
// this just breaks ties. IDs rotate over time, hence the live discovery below.
const PREFERENCE_HINTS = [
  "deepseek",
  "qwen",
  "llama-3.3",
  "llama-3.1",
  "gemini-2.0-flash",
  "mistral",
  "gemma",
  "phi-3",
];

let modelsCache = { at: 0, models: [] };

// Not text-chat models — would never produce a usable JSON verdict even though
// OpenRouter lists them at zero price.
const NON_CHAT_PATTERNS = ["lyria", "content-safety", "embed", "moderat", "guard"];

function isFree(model) {
  const p = model.pricing || {};
  const zeroPricing = Number(p.prompt) === 0 && Number(p.completion) === 0;
  const free = zeroPricing || model.id.endsWith(":free");
  if (!free) return false;
  return !NON_CHAT_PATTERNS.some((bad) => model.id.toLowerCase().includes(bad));
}

function preferenceRank(id) {
  const idx = PREFERENCE_HINTS.findIndex((hint) => id.toLowerCase().includes(hint));
  return idx === -1 ? PREFERENCE_HINTS.length : idx;
}

export async function getFreeModels({ force = false } = {}) {
  const now = Date.now();
  if (!force && modelsCache.models.length && now - modelsCache.at < MODELS_CACHE_TTL_MS) {
    return modelsCache.models;
  }

  const res = await fetch(`${API}/models`, { cache: "no-store" });
  if (!res.ok) {
    if (modelsCache.models.length) return modelsCache.models; // serve stale on transient failure
    throw new Error(`Failed to fetch OpenRouter model list (${res.status})`);
  }
  const data = await res.json();
  const free = (data.data || [])
    .filter(isFree)
    .sort((a, b) => {
      const rankDiff = preferenceRank(a.id) - preferenceRank(b.id);
      if (rankDiff !== 0) return rankDiff;
      return (b.context_length || 0) - (a.context_length || 0);
    })
    .map((m) => ({ id: m.id, provider: "openrouter", name: m.name, context_length: m.context_length }));

  modelsCache = { at: now, models: free };
  return free;
}

function extractJsonBlock(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* fall through */
    }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    try {
      return JSON.parse(text.slice(first, last + 1));
    } catch {
      /* fall through */
    }
  }
  return null;
}

// `externalSignal` lets the caller (the cross-provider race in lib/judge.js) cancel
// this request the instant a different model wins — no point letting a slow/rate-limited
// model keep running once we already have an answer. Wrapping both signals with
// AbortSignal.any means a timeout OR an external cancel both work identically.
export async function callOpenRouterModel(modelId, { systemPrompt, userPrompt }, externalSignal) {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
  const signal = externalSignal
    ? AbortSignal.any([timeoutController.signal, externalSignal])
    : timeoutController.signal;

  try {
    const res = await fetch(`${API}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gitjury.app",
        "X-Title": "GitJury",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: body.slice(0, 300) };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return { ok: false, status: 502, error: "Empty response from model" };

    const parsed = extractJsonBlock(text);
    if (!parsed) return { ok: false, status: 502, error: "Model did not return parseable JSON" };

    return { ok: true, parsed, raw: text, modelId };
  } catch (err) {
    const cancelled = externalSignal?.aborted && !timeoutController.signal.aborted;
    return {
      ok: false,
      status: 0,
      error: cancelled ? "Cancelled (another model won)" : err.name === "AbortError" ? "Timed out" : String(err.message || err),
    };
  } finally {
    clearTimeout(timeout);
  }
}
