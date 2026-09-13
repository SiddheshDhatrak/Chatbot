/** Persisted message feedback (thumbs up/down), stored locally per message id. */

export type FeedbackValue = "up" | "down";

const KEY = "claude-feedback-v1";

function readAll(): Record<string, FeedbackValue> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const json = JSON.parse(raw);
    if (json && typeof json === "object") return json as Record<string, FeedbackValue>;
  } catch {
    /* ignore */
  }
  return {};
}

export function getFeedback(id: string): FeedbackValue | null {
  return readAll()[id] ?? null;
}

export function setFeedback(id: string, value: FeedbackValue | null): void {
  try {
    const all = readAll();
    if (value) all[id] = value;
    else delete all[id];
    // cap growth: keep the most recent ~500 entries
    const keys = Object.keys(all);
    if (keys.length > 500) {
      for (const k of keys.slice(0, keys.length - 500)) delete all[k];
    }
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent("claude-feedback", { detail: { id, value } }));
}
