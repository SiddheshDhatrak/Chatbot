/**
 * Which NEXORA rows count as real NEXORA results.
 *
 * A run that used the provider fallback (Pollinations, no tools) or failed on
 * a Groq 429 is not a NEXORA answer: it is marked "invalid_rate_limited",
 * not scored, excluded from every aggregate, and retried on the next run.
 */
import type { NexoraResult, QuestionResult } from "./run";

export const INVALID_STATUS = "invalid_rate_limited" as const;
export const DAILY_RETRY_THRESHOLD_MS = 5 * 60_000;

const RE_429 = /\b429\b|rate limit reached|rate_limit_exceeded/i;
const RE_DAILY = /per day|\bTPD\b|\bRPD\b|daily/i;

/** Evidence that this run was rate limited / fell back; null for a genuine run. */
export function rateLimitEvidence(n: NexoraResult): string | null {
  if (n.usedFallback || n.stoppedBy === "fallback")
    return n.warnings.find((w) => /unavailable|fallback/i.test(w)) ?? "Used the provider fallback (no tools)";
  const w = n.warnings.find((x) => RE_429.test(x) && !/^Pausing/i.test(x));
  if (w) return w;
  if (n.error && RE_429.test(n.error)) return n.error;
  return null;
}

/** True when an error text / retry time means "wait for tomorrow", not "wait a minute". */
export function isDailyLimit(message: string, retryAfterMs?: number | null): boolean {
  return RE_DAILY.test(message) || (retryAfterMs != null && retryAfterMs > DAILY_RETRY_THRESHOLD_MS);
}

export const is429 = (message: string) => RE_429.test(message);

/** Mark a rate-limited row invalid and drop its score (idempotent). Genuine rows are returned unchanged. */
export function normalizeNexora(n: NexoraResult): NexoraResult {
  if (n.status === INVALID_STATUS) return n;
  const evidence = rateLimitEvidence(n);
  if (!evidence) return n;
  const rest: NexoraResult = { ...n };
  delete rest.correctness; // never scored
  return { ...rest, status: INVALID_STATUS, invalidReason: evidence };
}

export type RowKind = "valid" | "invalid" | "error" | "pending";

export function rowKind(r: QuestionResult): RowKind {
  const n = r.nexora;
  if (!n) return "pending";
  if (n.status === INVALID_STATUS || rateLimitEvidence(n)) return "invalid";
  if (n.error) return "error";
  return "valid";
}
