/**
 * Non-streaming Groq call WITH tool calling, for the NEXORA agent.
 * Reuses the endpoint, default model and error formatting from ai.ts
 * (raw fetch, same as the chat path; no groq-sdk).
 */
import { GROQ_URL, defaultModel, providerError } from "./ai";

/** OpenAI-compatible message shapes used in a tool-calling conversation. */
export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}
export type AgentMsg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface RateLimitInfo {
  /** Tokens left in the current per-minute window. */
  remainingTokens: number;
  /** Milliseconds until the token window resets. */
  resetMs: number;
}

export interface GroqToolsResult {
  message: { role: "assistant"; content: string | null; tool_calls?: ToolCall[] };
  tool_calls: ToolCall[];
  /** gpt-oss models return their hidden reasoning separately; useful for the "reason" trace. */
  reasoning?: string;
  usage?: Usage;
  rateLimit?: RateLimitInfo;
}

/** Parse Groq durations like "577ms", "22.3s", "1m2.5s". */
function parseDurationMs(s: string | null): number {
  if (!s) return NaN;
  const m = s.trim().match(/^(?:(\d+)m(?!s))?(?:([\d.]+)s)?(?:([\d.]+)ms)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return NaN;
  return Number(m[1] ?? 0) * 60_000 + Number(m[2] ?? 0) * 1000 + Number(m[3] ?? 0);
}

function readRateLimit(res: Response): RateLimitInfo | undefined {
  const remaining = Number(res.headers.get("x-ratelimit-remaining-tokens"));
  const resetMs = parseDurationMs(res.headers.get("x-ratelimit-reset-tokens"));
  if (!Number.isFinite(remaining) || !Number.isFinite(resetMs)) return undefined;
  return { remainingTokens: remaining, resetMs };
}

export interface GroqToolsOptions {
  /** "auto" lets the model decide; "none" disables tools for a forced final answer. */
  toolChoice?: "auto" | "none";
  signal?: AbortSignal;
  maxTokens?: number;
}

// ---------------------------------------------------------------------------
// Research-mode model selection
// ---------------------------------------------------------------------------

/** Tool-calling models to try, in order. Override with NEXORA_MODELS="a,b". */
export const RESEARCH_MODELS = ["openai/gpt-oss-120b", "llama-3.1-8b-instant", "openai/gpt-oss-20b"];

const MODELS_URL = GROQ_URL.replace(/\/chat\/completions$/, "/models");
let modelCache: { at: number; ids: Set<string> } | null = null;

/** Model ids this API key can use (cached 10 min). null if the list can't be fetched. */
async function availableGroqModels(): Promise<Set<string> | null> {
  if (modelCache && Date.now() - modelCache.at < 10 * 60_000) return modelCache.ids;
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(MODELS_URL, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id: string; active?: boolean }[] };
    const ids = new Set((json.data ?? []).filter((m) => m.active !== false).map((m) => m.id));
    modelCache = { at: Date.now(), ids };
    return ids;
  } catch {
    return null;
  }
}

/**
 * Pick the first working model: the caller's preferred model if this key has
 * it, else the first available entry of the research list.
 */
export async function resolveResearchModel(
  preferred?: string,
): Promise<{ model: string; skipped: string[]; noneAvailable?: boolean }> {
  // OpenRouter models are used only when explicitly requested, never as a fallback.
  if (isOpenRouterModel(preferred)) return { model: preferred!, skipped: [] };
  const fromEnv = (process.env.NEXORA_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !isOpenRouterModel(s));
  const candidates = [...new Set([preferred, ...(fromEnv.length ? fromEnv : RESEARCH_MODELS)].filter(Boolean))] as string[];
  const first = candidates[0] ?? defaultModel();
  const available = await availableGroqModels();
  if (!available) return { model: first, skipped: [] }; // can't check; try the first
  const skipped: string[] = [];
  for (const m of candidates) {
    if (available.has(m)) return { model: m, skipped };
    skipped.push(m);
  }
  // Nothing on the list is available; try the first and let the call fail into the fallback.
  return { model: first, skipped: [], noneAvailable: true };
}

const RETRYABLE = (status: number) => status === 429 || status >= 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_WAIT_MS = 30_000;

/**
 * How long to wait before the single retry. Groq's free tier has a
 * tokens-per-minute limit and tells us how long to wait, either in the
 * retry-after header or as "Please try again in 8.5s" in the body.
 */
function retryDelayMs(res: Response, body: string): number {
  let secs = Number(res.headers.get("retry-after"));
  const m = body.match(/try again in (?:(\d+)m)?([\d.]+)s/i);
  if (m) secs = Number(m[1] ?? 0) * 60 + Number(m[2]);
  if (!Number.isFinite(secs) || secs <= 0) return 1500;
  return Math.min(secs * 1000 + 500, MAX_WAIT_MS);
}

/** Reasoning models accept reasoning_effort; others (llama) may reject it. */
const isReasoningModel = (m: string) => /gpt-oss|qwen3|deepseek-r1/i.test(m);

// ---------------------------------------------------------------------------
// Optional OpenRouter provider (research mode only, explicit opt-in)
// ---------------------------------------------------------------------------

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_PREFIX = "openrouter:";
const OPENROUTER_429_WAIT_MS = 5000;

/** "openrouter:vendor/model:free" -> routed to OpenRouter. Everything else -> Groq. */
export const isOpenRouterModel = (m?: string) => !!m && m.startsWith(OPENROUTER_PREFIX);

/**
 * A provider error that must stop the run with no retries and no fallback,
 * e.g. OpenRouter's free daily request limit (failed calls also count) or
 * a missing API key for an explicitly requested provider.
 */
export class ProviderStopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderStopError";
  }
}

const isDailyLimit = (status: number, text: string) =>
  status === 402 || /per[-\s]?day|daily|insufficient credits|credits/i.test(text);

/**
 * Some models return tool_calls with no id, or with `arguments` as an object
 * instead of a JSON string. Normalise so the harness and the next request
 * always see the OpenAI shape.
 */
function normalizeToolCalls(raw: unknown): ToolCall[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t === "object" && (t as ToolCall).function?.name)
    .map((t, i) => {
      const fn = (t as { function: { name: string; arguments?: unknown } }).function;
      const args = fn.arguments;
      const id = (t as { id?: unknown }).id;
      return {
        id: typeof id === "string" && id ? id : `call_${Date.now().toString(36)}_${i}`,
        type: "function" as const,
        function: {
          name: fn.name,
          arguments: typeof args === "string" ? args : args == null ? "{}" : JSON.stringify(args),
        },
      };
    });
}

export async function callGroqWithTools(
  messages: AgentMsg[],
  tools: unknown[],
  model?: string,
  opts: GroqToolsOptions = {},
): Promise<GroqToolsResult> {
  const viaOpenRouter = isOpenRouterModel(model);
  const provider = viaOpenRouter ? "OpenRouter" : "Groq";
  const key = viaOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.GROQ_API_KEY;
  if (!key) {
    if (viaOpenRouter) throw new ProviderStopError("OPENROUTER_API_KEY is not set");
    throw new Error("GROQ_API_KEY is not set");
  }
  const m = viaOpenRouter ? model!.slice(OPENROUTER_PREFIX.length) : model || defaultModel();

  const body: Record<string, unknown> = {
    model: m,
    messages,
    temperature: 0.2, // research: favour faithfulness over creativity
  };
  // OpenRouter normalises on max_tokens; reasoning models there need more room.
  if (viaOpenRouter) body.max_tokens = opts.maxTokens ?? 4096;
  else body.max_completion_tokens = opts.maxTokens ?? 2048;
  if (tools.length) {
    body.tools = tools;
    body.tool_choice = opts.toolChoice ?? "auto";
  }
  if (!viaOpenRouter && isReasoningModel(m)) body.reasoning_effort = "low";

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  if (viaOpenRouter) {
    headers["HTTP-Referer"] = "http://localhost:5173";
    headers["X-Title"] = "NEXORA";
  }

  // Groq: one retry on 429 / 5xx / network error, waiting as long as Groq asks.
  // OpenRouter: one retry on 429 after 5s; daily limit / 402 stops at once,
  // because every failed call also counts against the 50 requests/day.
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(viaOpenRouter ? OPENROUTER_URL : GROQ_URL, {
        method: "POST",
        signal: opts.signal,
        headers,
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (attempt === 0 && !opts.signal?.aborted) {
        await sleep(1000);
        continue;
      }
      throw err;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (viaOpenRouter) {
        if (isDailyLimit(res.status, text))
          throw new ProviderStopError(
            `OpenRouter limit reached (${providerError(provider, res.status, text).message}). ` +
              "Stopping without retries; free models allow about 50 requests/day.",
          );
        if (attempt === 0 && res.status === 429) {
          await sleep(OPENROUTER_429_WAIT_MS);
          continue;
        }
      } else if (attempt === 0 && RETRYABLE(res.status)) {
        await sleep(retryDelayMs(res, text));
        continue;
      }
      throw providerError(provider, res.status, text);
    }

    const json = (await res.json()) as {
      choices?: {
        message?: { content?: string | null; tool_calls?: unknown; reasoning?: string };
      }[];
      usage?: Usage;
      error?: { code?: number | string; message?: string };
    };
    // OpenRouter can return HTTP 200 with an error body (upstream provider failed).
    if (json.error) {
      const code = Number(json.error.code) || 500;
      const text = JSON.stringify({ error: json.error });
      if (viaOpenRouter && isDailyLimit(code, json.error.message ?? ""))
        throw new ProviderStopError(`OpenRouter limit reached (${json.error.message}). Stopping without retries.`);
      throw providerError(provider, code, text);
    }
    const msg = json.choices?.[0]?.message ?? {};
    const tool_calls = normalizeToolCalls(msg.tool_calls);
    return {
      // Only the fields the API accepts back in the next request (drop `reasoning`).
      message: {
        role: "assistant",
        content: msg.content ?? null,
        ...(tool_calls.length ? { tool_calls } : {}),
      },
      tool_calls,
      reasoning: msg.reasoning || undefined,
      usage: json.usage,
      // Tokens-per-minute pacing is a Groq free-tier concern; never pace OpenRouter.
      rateLimit: viaOpenRouter ? undefined : readRateLimit(res),
    };
  }
}
