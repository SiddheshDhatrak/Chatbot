import { describe, expect, it } from "vitest";
import { applyAgentEvent, isWaiting, newResearchView, type AgentEvent } from "./research";
import { analyzeCitations, annotateCitations, splitSources, withHarnessSources } from "@/server/citations";

describe("research view reducer", () => {
  it("folds agent events into trace items, answer and metrics", () => {
    const events = [
      { type: "run_start", runId: "r1", model: "openai/gpt-oss-120b" },
      { type: "act", step: 1, tool: "web_search", args: { query: "groq pricing" } },
      { type: "observe", step: 1, tool: "web_search", ok: true, preview: "5 results", latencyMs: 900 },
      { type: "warning", message: "Pausing 30s for Groq's tokens-per-minute limit." },
    ] as AgentEvent[];
    let v = newResearchView();
    for (const e of events) v = applyAgentEvent(v, e);

    expect(v.runId).toBe("r1");
    expect(v.items.map((i) => i.kind)).toEqual(["act", "observe", "pause"]);
    expect(v.items[0]!.text).toBe('"groq pricing"');
    expect(v.items[2]!.pauseMs).toBe(30_000);
    expect(isWaiting(v)).toBe(true); // UI shows "Waiting for rate limit..."

    v = applyAgentEvent(v, { type: "act", step: 2, tool: "read_page", args: { url: "https://x.dev" } });
    expect(isWaiting(v)).toBe(false);
  });
});

describe("rendered research answer", () => {
  const page = "Llama-3.3-70B-SpecDec\nInput Token Price | $0.59 per 1M tokens |";
  const reg = { get: (i: number) => (i === 1 ? { url: "https://groq.dev/llama", wasRead: true, text: page } : undefined) };

  it("strips the Sources list and marks each [n] with its own claim's support status", () => {
    const raw =
      "Llama 3.3 70B costs $0.59 per 1M input tokens [1]. GPT-OSS 120B costs $0.15 per 1M input tokens [1].";
    const report = analyzeCitations(raw, reg, new Set(["https://groq.dev/llama"]));
    const text = withHarnessSources(raw, [{ index: 1, url: "https://groq.dev/llama", title: "Llama" }]);

    const body = splitSources(text).body.trimEnd();
    expect(body).not.toMatch(/Sources/);
    const shown = annotateCitations(body, report.claims);
    expect(shown).toContain("tokens [\\[1\\]](#cite-1-supported).");
    expect(shown).toContain("tokens [\\[1\\]](#cite-1-unsupported).");
  });
});
