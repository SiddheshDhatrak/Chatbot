/**
 * Load a saved NEXORA run (GET /api/runs/:id) and turn it into the same
 * ResearchView a live answer uses, so reloaded answers render identically.
 * Runs saved before reportJson existed fall back to Steps + Sources rows.
 */
import type { StoredReport } from "@/server/agent";
import { normalizeCitations, splitSources } from "@/server/citations";
import { applyAgentEvent, type AgentMetrics, type ResearchView, type TraceItem, type UISource } from "@/lib/research";

export interface RunStep {
  id: string;
  stepNo: number;
  tool: string;
  args: Record<string, unknown> | null;
  auto: boolean;
  observation: string;
  observationLength: number;
  error: boolean;
  latencyMs: number;
  createdAt: number;
}

export interface RunData {
  id: string;
  question: string;
  status: string;
  cancelled: boolean;
  model: string;
  startedAt: number;
  finishedAt: number | null;
  totalLatencyMs: number | null;
  totalSteps: number;
  totalToolCalls: number;
  totalTokens: number | null;
  usedFallback: boolean;
  finalAnswer: string | null;
  citationPrecision: number | null;
  maxSteps: number | null;
  report: StoredReport | null;
  steps: RunStep[];
  notes: { id: string; title: string; content: string; sourceUrl: string | null }[];
  sources: { index: number; url: string; title: string | null; wasRead: boolean }[];
}

const cache = new Map<string, Promise<RunData | null>>();

/** Fetch a run once per page load (null when it doesn't exist or can't be loaded). */
export function fetchRun(id: string): Promise<RunData | null> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/api/runs/${encodeURIComponent(id)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as { run: RunData }).run : null))
      .catch(() => null);
    p.then((run) => {
      if (!run) cache.delete(id); // allow a retry later
    });
    cache.set(id, p);
  }
  return p;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Strip the <untrusted_web_data> wrapper and parse the JSON inside, if possible. */
function unwrap(observation: string): { raw: string; data: unknown } {
  // Linear trimming (no regex over trailing whitespace).
  let raw = observation.trim();
  if (raw.startsWith("<untrusted_web_data")) raw = raw.slice(raw.indexOf(">") + 1);
  if (raw.endsWith("…")) raw = raw.slice(0, -1).trimEnd();
  if (raw.endsWith("</untrusted_web_data>")) raw = raw.slice(0, -"</untrusted_web_data>".length);
  raw = raw.trim();
  try {
    return { raw, data: JSON.parse(raw) };
  } catch {
    return { raw, data: null };
  }
}

/** One-line preview + expandable detail for a saved Step (mirrors the live "observe" preview). */
export function describeStep(step: RunStep): { preview: string; detail: string } {
  const { raw, data } = unwrap(step.observation);
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  let preview: string;
  if (raw.startsWith("[harness]")) preview = "Duplicate call skipped (loop guard)";
  else if (step.error) preview = String(obj.error ?? clip(raw, 160));
  else if (step.tool === "web_search" && Array.isArray(data)) {
    const hits = data as { source?: number; title?: string }[];
    preview = `${hits.length} results: ${hits.map((h) => `[${h.source}] ${clip(String(h.title ?? ""), 50)}`).join(" | ")}`;
  } else if (step.tool === "read_page") {
    const title = String(obj.title ?? raw.match(/"title":"([^"]*)"/)?.[1] ?? "page");
    const src = obj.source ?? raw.match(/"source":(\d+)/)?.[1];
    const len = typeof obj.text === "string" ? obj.text.length : step.observationLength;
    preview = `${src ? `[${src}] ` : ""}${clip(title, 70)} (${len} chars)`;
  } else if (step.tool === "save_note") {
    preview = step.auto ? `Auto-saved note "${clip(String(step.args?.title ?? ""), 60)}"` : `Saved note "${clip(String(obj.title ?? step.args?.title ?? ""), 60)}"`;
  } else preview = clip(raw, 160);

  // Detail: page text as text, everything else as pretty JSON.
  let detail: string;
  if (step.tool === "read_page" && typeof obj.text === "string")
    detail = `${obj.title ?? ""}\n${obj.url ?? ""}${obj.publishedDate ? ` · ${obj.publishedDate}` : ""}\n\n${obj.text}`;
  else detail = data ? JSON.stringify(data, null, 2) : raw;
  return { preview, detail: clip(detail, 4000) };
}

function argsText(step: RunStep): string {
  const a = step.args ?? {};
  if (a.auto === true) return `auto-note "${String(a.title ?? "")}"`;
  if (step.tool === "web_search") return `"${String(a.query ?? "")}"`;
  if (step.tool === "read_page") return String(a.url ?? "");
  if (step.tool === "save_note") return `"${String(a.title ?? "")}"`;
  return JSON.stringify(a).slice(0, 120);
}

/**
 * Full timeline for the "View research trace" panel: reasoning (from the
 * stored events, when present), then each saved Step as Act + Observe with
 * an expandable detail, with warnings placed after the step they followed.
 */
export function traceFromRun(run: RunData): TraceItem[] {
  const events = run.report?.events ?? [];
  const reasons = new Map<number, string>();
  const warningsAfter = new Map<number, string[]>(); // step -> warnings that followed it
  let lastStep = 0;
  for (const e of events) {
    if (e.type === "reason" && !reasons.has(e.step)) reasons.set(e.step, e.text);
    if ("step" in e && typeof e.step === "number") lastStep = e.step;
    if (e.type === "warning") warningsAfter.set(lastStep, [...(warningsAfter.get(lastStep) ?? []), e.message]);
  }
  const warnItem = (text: string): TraceItem => {
    const m = text.match(/^Pausing (\d+)s/);
    return m ? { kind: "pause", at: 0, text, pauseMs: Number(m[1]) * 1000 } : { kind: "warning", at: 0, text };
  };

  const items: TraceItem[] = (warningsAfter.get(0) ?? []).map(warnItem);
  const stepNos = [...new Set([...run.steps.map((s) => s.stepNo), ...reasons.keys()])].sort((a, b) => a - b);
  for (const n of stepNos) {
    const r = reasons.get(n);
    if (r) items.push({ kind: "reason", at: 0, step: n, text: r });
    for (const s of run.steps.filter((x) => x.stepNo === n)) {
      const d = describeStep(s);
      items.push({ kind: "act", at: 0, step: n, tool: s.tool, text: argsText(s) });
      items.push({ kind: "observe", at: 0, step: n, tool: s.tool, ok: !s.error, text: d.preview, latencyMs: s.latencyMs, detail: d.detail });
    }
    for (const w of warningsAfter.get(n) ?? []) items.push(warnItem(w));
  }
  return items;
}

/** Rebuild the answer view (chips, Sources, warnings, footer) from a saved run. */
export function viewFromRun(run: RunData, answerText: string): ResearchView {
  const rep = run.report;
  let view: ResearchView = { runId: run.id, model: run.model, startedAt: run.startedAt, items: [] };

  if (rep?.events?.length) {
    // Replay the stored events: identical to what the live answer saw.
    for (const ev of rep.events) view = applyAgentEvent(view, ev);
  } else {
    view.items = traceFromRun(run);
  }

  if (!view.answer) {
    // Old run: no report. Sources = rows the answer actually cites; no support data.
    const body = splitSources(normalizeCitations(answerText)).body;
    const cited = new Set([...body.matchAll(/\[(\d{1,3})\]/g)].map((m) => Number(m[1])));
    const sources: UISource[] = run.sources
      .filter((s) => cited.has(s.index))
      .map((s) => ({ index: s.index, url: s.url, title: s.title || s.url, wasRead: s.wasRead }));
    view.answer = { sources };
  }

  if (rep?.metrics) view.metrics = rep.metrics;
  else {
    const partial: Partial<AgentMetrics> = {
      runId: run.id,
      model: run.model,
      status: run.status as AgentMetrics["status"],
      ...(run.cancelled ? { stoppedBy: "aborted" as const } : {}),
      ...(run.totalLatencyMs != null ? { latencyMs: run.totalLatencyMs } : {}),
      steps: run.totalSteps,
      toolCalls: run.totalToolCalls,
      tokens: run.totalTokens != null ? { prompt: 0, completion: 0, total: run.totalTokens } : null,
      pagesRead: run.sources.filter((s) => s.wasRead).length,
      notesSaved: run.notes.length,
      usedFallback: run.usedFallback,
    };
    view.partialMetrics = partial;
  }
  view.finishedAt = run.finishedAt ?? run.startedAt + (run.totalLatencyMs ?? 0);
  view.historical = true;
  return view;
}
