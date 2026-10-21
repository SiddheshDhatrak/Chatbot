import { describe, expect, it } from "vitest";
import { isDailyLimit, normalizeNexora, rowKind } from "./validity";
import { renderMarkdown } from "./report";
import type { NexoraResult, ResultsFile } from "./run";
import type { EvalQuestion } from "./score";

const base = (over: Partial<NexoraResult>): NexoraResult => ({
  answer: "x",
  runId: "r",
  latencyMs: 1000,
  steps: 2,
  toolCalls: 2,
  tokens: 100,
  status: "completed",
  stoppedBy: "answer",
  usedFallback: false,
  citationPrecision: 1,
  readRatio: 1,
  supportRate: 1,
  snippetOnlyCount: 0,
  warnings: [],
  correctness: { method: "contains", score: 1, correct: true },
  finishedAt: "2026-10-21T00:00:00Z",
  ...over,
});

const TPD =
  "Groq unavailable (Groq 429: Rate limit reached for model `openai/gpt-oss-120b` on tokens per day (TPD): …). Falling back to a model without tools";

describe("eval validity", () => {
  it("marks fallback runs invalid and drops their score; genuine rows are untouched", () => {
    const bad = normalizeNexora(base({ usedFallback: true, stoppedBy: "fallback", warnings: [TPD] }));
    expect(bad.status).toBe("invalid_rate_limited");
    expect(bad.correctness).toBeUndefined();
    expect(bad.invalidReason).toMatch(/tokens per day/);
    const good = base({});
    expect(normalizeNexora(good)).toBe(good);
  });

  it("recognises a daily limit by text or by a long retry time", () => {
    expect(isDailyLimit(TPD)).toBe(true);
    expect(isDailyLimit("Groq 429: Rate limit reached ... tokens per minute (TPM). Please try again in 7.2s", 7200)).toBe(false);
    expect(isDailyLimit("Groq 429: rate limit", 20 * 60_000)).toBe(true);
  });

  it("report: invalid rows are listed separately and excluded from all aggregates and the baseline", () => {
    const qs = [
      { id: "a", category: "single_fact", question: "A?", groundTruth: "a" },
      { id: "b", category: "single_fact", question: "B?", groundTruth: "b" },
    ] as EvalQuestion[];
    const file: ResultsFile = {
      meta: { model: "m", sessionId: null, createdAt: "2026-10-21T00:00:00Z", updatedAt: "2026-10-21T00:00:00Z" },
      results: {
        a: { id: "a", category: "single_fact", question: "A?", groundTruth: "a", nexora: base({ latencyMs: 10_000, tokens: 1000 }),
             baseline: { answer: "", latencyMs: 1000, tokens: 10, correctness: { method: "contains", score: 0, correct: false }, finishedAt: "" } },
        // Fallback row recorded as "completed" with a (meaningless) correct score and a correct baseline.
        b: { id: "b", category: "single_fact", question: "B?", groundTruth: "b",
             nexora: base({ usedFallback: true, stoppedBy: "fallback", warnings: [TPD], latencyMs: 99_000, tokens: 5 }),
             baseline: { answer: "b", latencyMs: 2000, tokens: 20, correctness: { method: "contains", score: 1, correct: true }, finishedAt: "" } },
      },
    };
    expect(rowKind(file.results.b!)).toBe("invalid");
    const md = renderMarkdown(file, qs);
    expect(md).toContain("**1 valid / 2 run**");
    expect(md).toContain("## Not evaluated (rate limited)");
    expect(md).toContain("| Avg latency | 10.0s |"); // not (10s + 99s) / 2
    expect(md).toContain("| Avg tokens | 1000 |");
    expect(md).toContain("| Accuracy | 100% | 0% |"); // baseline only for question a
  });
});
