const API = "https://api.groq.com/openai/v1";
const MODELS_CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;

// Groq's catalog mixes chat models in with audio (whisper), TTS (orpheus), safety
// classifiers (prompt-guard, gpt-oss-safeguard), and agentic tool-use wrappers
// (compound) — none of those will follow a "return one JSON object" instruction the
// way a plain instruct model does, so they're excluded even though they're free too.
const NON_CHAT_PATTERNS = ["whisper", "orpheus", "prompt-guard", "compound", "safeguard"];

const PREFERENCE_HINTS = ["llama-3.3-70b", "gpt-oss-120b", "qwen3", "llama-4-scout", "gpt-oss-20b", "llama-3.1-8b"];

let modelsCache = { at: 0, models: [] };

function isChatModel(model) {
  return !NON_CHAT_PATTERNS.some((bad) => model.id.toLowerCase().includes(bad));
}

function preferenceRank(id) {
  const idx = PREFERENCE_HINTS.findIndex((hint) => id.toLowerCase().includes(hint));
  return idx === -1 ? PREFERENCE_HINTS.length : idx;
}

export function hasGroqKey() {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function getGroqModels({ force = false } = {}) {
  if (!hasGroqKey()) return [];

  const now = Date.now();
  if (!force && modelsCache.models.length && now - modelsCache.at < MODELS_CACHE_TTL_MS) {
    return modelsCache.models;
  }

  const res = await fetch(`${API}/models`, {
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) {
    if (modelsCache.models.length) return modelsCache.models;
    return [];
  }
  const data = await res.json();
  const chatModels = (data.data || [])
    .filter(isChatModel)
    .sort((a, b) => preferenceRank(a.id) - preferenceRank(b.id))
    .map((m) => ({ id: m.id, provider: "groq" }));

  modelsCache = { at: now, models: chatModels };
  return chatModels;
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

export async function callGroqModel(modelId, { systemPrompt, userPrompt }, externalSignal) {
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
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
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
