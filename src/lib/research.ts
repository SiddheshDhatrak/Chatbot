/**
 * Client-side state for one NEXORA research answer, built from the
 * {"agent": {...}} SSE frames. Types come straight from the server modules
 * (type-only imports, erased at build time) so field names can't drift.
 */
import type { AgentEvent, AgentMetrics } from "@/server/agent";
import type { CitationReport, SourceRef } from "@/server/citations";

export type { AgentEvent, AgentMetrics, CitationReport, SourceRef };

export interface TraceItem {
  kind: "reason" | "act" | "observe" | "warning" | "pause";
  at: number;
  step?: number;
  tool?: string;
  text: string;
  ok?: boolean;
  latencyMs?: number;
  /** For "pause": how long the harness said it would wait. */
  pauseMs?: number;
}

export interface ResearchView {
  runId?: string;
  model?: string;
  startedAt: number;
  finishedAt?: number;
  items: TraceItem[];
  answer?: { sources: SourceRef[]; report: CitationReport };
  metrics?: AgentMetrics;
}

export const newResearchView = (): ResearchView => ({ startedAt: Date.now(), items: [] });

const PAUSE_RE = /^Pausing (\d+)s for .*rate|^Pausing (\d+)s/i;

function argsSummary(tool: string, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  if (a.auto === true) return `auto-note "${String(a.title ?? "")}"`;
  if (tool === "web_search") return `"${String(a.query ?? "")}"`;
  if (tool === "read_page") return String(a.url ?? "");
  if (tool === "save_note") return `"${String(a.title ?? "")}"`;
  return JSON.stringify(a).slice(0, 120);
}

/** Pure reducer: fold one agent event into the view. */
export function applyAgentEvent(view: ResearchView, ev: AgentEvent): ResearchView {
  const at = Date.now();
  switch (ev.type) {
    case "run_start":
      return { ...view, runId: ev.runId, model: ev.model };
    case "reason":
      return { ...view, items: [...view.items, { kind: "reason", at, step: ev.step, text: ev.text }] };
    case "act":
      return {
        ...view,
        items: [...view.items, { kind: "act", at, step: ev.step, tool: ev.tool, text: argsSummary(ev.tool, ev.args) }],
      };
    case "observe":
      return {
        ...view,
        items: [
          ...view.items,
          { kind: "observe", at, step: ev.step, tool: ev.tool, ok: ev.ok, text: ev.preview, latencyMs: ev.latencyMs },
        ],
      };
    case "warning": {
      const m = ev.message.match(PAUSE_RE);
      const item: TraceItem = m
        ? { kind: "pause", at, text: ev.message, pauseMs: Number(m[1] ?? m[2]) * 1000 }
        : { kind: "warning", at, text: ev.message };
      return { ...view, items: [...view.items, item] };
    }
    case "answer":
      return { ...view, answer: { sources: ev.sources, report: ev.citationReport } };
    case "done":
      return { ...view, metrics: ev.metrics, finishedAt: at };
    default:
      return view;
  }
}

export const isWaiting = (view: ResearchView) => !view.metrics && view.items.at(-1)?.kind === "pause";

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
