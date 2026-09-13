/** Single source of truth for selectable chat models (both Vite + Next). */

export interface ModelOption {
  id: string;
  label: string;
  hint: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", hint: "Default · Groq" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", hint: "Groq" },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", hint: "Fast · Groq" },
];

export const DEFAULT_MODEL_ID = "openai/gpt-oss-120b";

export const DEFAULT_MODEL =
  (typeof process !== "undefined" && process.env?.GROQ_MODEL) || DEFAULT_MODEL_ID;

const KEY = "claude-model";

export function getModel(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && AVAILABLE_MODELS.some((m) => m.id === saved)) return saved;
  } catch {
    /* SSR / private mode */
  }
  const fallback = AVAILABLE_MODELS.some((m) => m.id === DEFAULT_MODEL)
    ? DEFAULT_MODEL
    : AVAILABLE_MODELS[0]!.id;
  return fallback;
}

export function setStoredModel(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

/** Allow env-configured default plus the curated list; reject everything else. */
export function sanitizeModel(input: unknown): string | null {
  if (typeof input !== "string" || !input) return null;
  const id = input.trim().slice(0, 80);
  if (AVAILABLE_MODELS.some((m) => m.id === id)) return id;
  if (id === DEFAULT_MODEL) return id;
  return null;
}

export function modelLabel(id: string): string {
  return AVAILABLE_MODELS.find((m) => m.id === id)?.label ?? id;
}
