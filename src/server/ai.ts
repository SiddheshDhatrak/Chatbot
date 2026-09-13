export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export const SYSTEM_PROMPT =
  "You are Claude, a refined AI assistant with a warm, elegant voice. " +
  "Answer helpfully and concisely. Use Markdown formatting (headings, lists, tables) where it aids clarity. " +
  "Wrap code in fenced code blocks with a language tag.";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const POLLINATIONS_URL = "https://text.pollinations.ai/openai";

function defaultModel() {
  return process.env.GROQ_MODEL || "openai/gpt-oss-120b";
}

function providerError(provider: string, status: number, text: string) {
  let detail = text.slice(0, 240);
  try {
    const json = JSON.parse(text);
    detail = json.error?.message || json.message || detail;
  } catch {
    // Keep the raw response when the provider does not return JSON.
  }
  return new Error(`${provider} ${status}: ${detail}`);
}

/** Parse an OpenAI-style SSE byte stream into content deltas. */
async function* parseSSE(
  res: Response,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data);
          const delta: string =
            json.choices?.[0]?.delta?.content ??
            json.choices?.[0]?.message?.content ??
            "";
          if (delta) yield delta;
        } catch {
          /* ignore partial JSON frames */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function* groqStream(
  messages: ChatMsg[],
  signal?: AbortSignal,
  model?: string,
): AsyncGenerator<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  const res = await fetch(GROQ_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model || defaultModel(),
      messages,
      stream: true,
      temperature: 0.7,
      reasoning_effort: "low",
      max_completion_tokens: 2048,
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw providerError("Groq", res.status, text);
  }
  yield* parseSSE(res, signal);
}

/** Keyless fallback — OpenAI-compatible streaming, then plain-text GET. */
async function* pollinationsStream(
  messages: ChatMsg[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const key = process.env.POLLINATIONS_API_KEY;
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  try {
    const res = await fetch(POLLINATIONS_URL, {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify({ model: "openai", messages, stream: true }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw providerError("Pollinations", res.status, text);
    }
    yield* parseSSE(res, signal);
    return;
  } catch (err) {
    if (signal?.aborted) return;
    // last resort: single plain-text completion of the latest user message
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const prompt = lastUser?.content ?? "Hello";
    const res = await fetch(
      `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`,
      { signal, headers },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw providerError("Pollinations", res.status, text || String(err));
    }
    const text = await res.text();
    if (text) yield text;
  }
}

/**
 * Stream the assistant reply. Uses Groq when configured; otherwise uses
 * Pollinations as a fallback provider.
 */
export async function* streamReply(
  messages: ChatMsg[],
  opts?: { signal?: AbortSignal; model?: string },
): AsyncGenerator<string> {
  const signal = opts?.signal;
  if (process.env.GROQ_API_KEY) {
    yield* groqStream(messages, signal, opts?.model);
    return;
  }
  yield* pollinationsStream(messages, signal);
}
