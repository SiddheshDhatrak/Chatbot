/** Every tool returns this shape and never throws, so the agent can recover. */
export type ToolResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): ToolResult<T> => ({ ok: true, data });
export const fail = (error: string): ToolResult<never> => ({ ok: false, error });

export function errMsg(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return "Request timed out";
    return err.message;
  }
  return String(err);
}

/** Canonical form used to compare URLs (citations vs. retrieved pages). */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}
