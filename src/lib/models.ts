import "./storageKeys";

/** Single source of truth for selectable chat models (both Vite + Next). */

export interface ModelOption {
  id: string;
  label: string;
  hint: string;
}

/**
 * Only models verified to work with the configured Groq key (its /models list
 * has no Llama 3.3 70B or Llama 3.1 8B: those returned "model not found").
 * Used by the picker for both normal chat and Research mode.
 */
export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", hint: "Default · Groq" },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", hint: "Faster · Groq" },
];

/** True if `id` is offered by the picker. */
export function isSelectableModel(id: unknown): id is string {
  return typeof id === "string" && AVAILABLE_MODELS.some((m) => m.id === id);
}

export const DEFAULT_MODEL_ID = "openai/gpt-oss-120b";

export const DEFAULT_MODEL =
  (typeof process !== "undefined" && process.env?.GROQ_MODEL) || DEFAULT_MODEL_ID;

const KEY = "nexora-model";

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
