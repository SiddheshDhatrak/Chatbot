/**
 * eval/errors.log: every Groq 429 seen during an evaluation run, untruncated,
 * with the retry-after / x-ratelimit headers, a timestamp and the question id.
 */
import { appendFileSync } from "node:fs";
import type { ProviderFailure } from "@/server/groqTools";

export const SCREEN_CHARS = 300;

/** What the runner is doing when a failure happens (set by the runner). */
export interface ErrorContext {
  questionId: string | null;
  mode: "nexora" | "baseline" | "judge" | null;
}

export function formatErrorEntry(f: ProviderFailure, ctx: ErrorContext): string {
  const headerLines = Object.keys(f.headers).length
    ? Object.entries(f.headers)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `  ${k}: ${v}`)
        .join("\n")
    : "  (no retry-after / x-ratelimit headers)";
  return [
    `[${new Date(f.at).toISOString()}] question=${ctx.questionId ?? "-"} mode=${ctx.mode ?? "-"} ` +
      `provider=${f.provider} status=${f.status} attempt=${f.attempt}` +
      (f.retryAfterMs != null ? ` retryAfterMs=${Math.round(f.retryAfterMs)}` : ""),
    "headers:",
    headerLines,
    "body:",
    f.body,
    "-".repeat(80),
    "",
  ].join("\n");
}

/** The on-screen line: first 300 characters of the error message. */
export function screenLine(f: ProviderFailure): string {
  const msg = `${f.provider} ${f.status}: ${f.body}`.replace(/\s+/g, " ");
  return msg.length > SCREEN_CHARS ? `${msg.slice(0, SCREEN_CHARS)}…` : msg;
}

/** Listener for onProviderFailure: Groq 429s only. */
export function makeGroq429Logger(file: string, ctx: ErrorContext, print: (s: string) => void) {
  return (f: ProviderFailure) => {
    if (f.provider !== "Groq" || f.status !== 429) return;
    appendFileSync(file, formatErrorEntry(f, ctx));
    print(`    ! 429 [${ctx.questionId ?? "-"} ${ctx.mode ?? ""}] ${screenLine(f)}`);
  };
}
