import { describe, expect, it } from "vitest";
import { describeStep, traceFromRun, viewFromRun, type RunData, type RunStep } from "./runs";
import { analyzeCitations } from "@/server/citations";
import type { AgentEvent, AgentMetrics } from "@/lib/research";

const URL1 = "https://console.groq.com/docs/model/openai/gpt-oss-120b";
const wrap = (tool: string, data: unknown) =>
  `<untrusted_web_data tool="${tool}">\n${JSON.stringify(data)}\n</untrusted_web_data>`;

const step = (p: Partial<RunStep>): RunStep => ({
  id: Math.random().toString(36),
  stepNo: 1,
  tool: "web_search",
  args: {},
  auto: false,
  observation: "",
  observationLength: 0,
  error: false,
  latencyMs: 100,
  createdAt: 0,
  ...p,
});

const steps: RunStep[] = [
  step({ stepNo: 1, tool: "web_search", args: { query: "gpt-oss context" }, observation: wrap("web_search", [{ source: 1, title: "GroqDocs", url: URL1 }]) }),
  step({ stepNo: 2, tool: "read_page", args: { url: URL1 }, observation: wrap("read_page", { source: 1, title: "OpenAI GPT-OSS 120B - GroqDocs", url: URL1, text: "CONTEXT WINDOW 131,072" }) }),
  step({ stepNo: 3, tool: "read_page", args: { url: "https://x.dev/404" }, error: true, observation: wrap("read_page", { error: "HTTP 404 Not Found" }) }),
];

const answerText = "GPT-OSS 120B has a 131,072-token context window [1].\n\n**Sources**\n\n[1] GroqDocs - " + URL1;

const baseRun = (over: Partial<RunData>): RunData => ({
  id: "r1",
  question: "context window?",
  status: "completed",
  cancelled: false,
  model: "openai/gpt-oss-120b",
  startedAt: 1000,
  finishedAt: 46_000,
  totalLatencyMs: 45_000,
  totalSteps: 3,
  totalToolCalls: 3,
  totalTokens: 9000,
  usedFallback: false,
  finalAnswer: answerText,
  citationPrecision: 1,
  maxSteps: 8,
  report: null,
  steps,
  notes: [],
  sources: [{ index: 1, url: URL1, title: "GroqDocs", wasRead: true }],
  ...over,
});

describe("saved run -> answer view", () => {
  it("replays the stored report: chips data, sources, warnings, metrics", () => {
    const registry = { get: (i: number) => (i === 1 ? { url: URL1, wasRead: true, text: "OpenAI GPT-OSS 120B - GroqDocs\nCONTEXT WINDOW 131,072" } : undefined) };
    const citationReport = analyzeCitations(answerText, registry, new Set([URL1]));
    const sources = [{ index: 1, url: URL1, title: "GroqDocs" }];
    const metrics = { status: "completed", stoppedBy: "answer", latencyMs: 45_000, steps: 3, maxSteps: 8, supportRate: 1 } as AgentMetrics;
    const events: AgentEvent[] = [
      { type: "run_start", runId: "r1", model: "openai/gpt-oss-120b" },
      { type: "reason", step: 1, text: "Search Groq docs." },
      { type: "warning", message: "Step limit (8) reached; answering with the evidence gathered so far." },
      { type: "answer", text: "", sources, citationReport },
    ];
    const run = baseRun({
      report: { version: 1, citationReport, sources, metrics, warnings: [], events, maxSteps: 8 },
    });
    const view = viewFromRun(run, answerText);

    expect(view.historical).toBe(true);
    expect(view.answer?.report?.supportRate).toBe(1);
    expect(view.answer?.sources).toEqual(sources);
    expect(view.metrics?.maxSteps).toBe(8);
    expect(view.items.some((i) => i.kind === "warning" && /Step limit/.test(i.text))).toBe(true);
    expect(view.finishedAt).toBe(46_000); // no live timer
  });

  it("opens an old run without a report from the text and Sources rows", () => {
    const view = viewFromRun(baseRun({ report: null }), answerText);
    expect(view.answer?.report).toBeUndefined();
    expect(view.answer?.sources).toEqual([{ index: 1, url: URL1, title: "GroqDocs", wasRead: true }]);
    expect(view.metrics).toBeUndefined();
    expect(view.partialMetrics).toMatchObject({ steps: 3, toolCalls: 3, pagesRead: 1, latencyMs: 45_000 });
    expect(view.partialMetrics?.supportRate).toBeUndefined(); // missing parts are left out
  });

  it("marks a cancelled old run as stopped", () => {
    const view = viewFromRun(baseRun({ status: "error", cancelled: true, report: null }), "Research stopped before an answer was produced.");
    expect(view.partialMetrics?.stoppedBy).toBe("aborted");
    expect(view.answer?.sources).toEqual([]);
  });
});

describe("saved trace", () => {
  it("orders Reason / Act / Observe per step with previews and expandable detail", () => {
    const events: AgentEvent[] = [
      { type: "reason", step: 1, text: "Find Groq docs." },
      { type: "reason", step: 2, text: "Read the docs page." },
      { type: "warning", message: "Pausing 30s for Groq's tokens-per-minute limit." },
    ];
    const run = baseRun({ report: { version: 1, citationReport: null, sources: [], metrics: null, warnings: [], events, maxSteps: 8 } });
    const items = traceFromRun(run);
    expect(items.map((i) => `${i.kind}${i.step ?? ""}`)).toEqual([
      "reason1", "act1", "observe1",
      "reason2", "act2", "observe2", "pause",
      "act3", "observe3",
    ]);
    expect(items[2]!.text).toBe("1 results: [1] GroqDocs");
    expect(items[5]!.text).toBe("[1] OpenAI GPT-OSS 120B - GroqDocs (22 chars)");
    expect(items[5]!.detail).toContain("CONTEXT WINDOW 131,072");
    expect(items[8]).toMatchObject({ ok: false, text: "HTTP 404 Not Found" });
  });

  it("previews auto-notes and loop-guard steps", () => {
    expect(describeStep(step({ tool: "save_note", auto: true, args: { auto: true, title: "Auto-note: GroqDocs" }, observation: '{"saved":true,"auto":true}' })).preview).toBe(
      'Auto-saved note "Auto-note: GroqDocs"',
    );
    expect(describeStep(step({ error: true, observation: "[harness] You already called web_search..." })).preview).toBe(
      "Duplicate call skipped (loop guard)",
    );
  });
});
