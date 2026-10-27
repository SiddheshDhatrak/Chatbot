"use client";
/**
 * NEXORA research answer UI: live trace panel, cited answer, Sources block
 * and metrics footer. Driven by the ResearchView built from agent frames.
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  CircleCheck,
  CircleX,
  Globe,
  Hourglass,
  ListTree,
  NotebookPen,
  Search,
  Telescope,
} from "lucide-react";
import { Markdown } from "@/components/ui/Markdown";
import { annotateCitations, splitSources } from "@/server/citations";
import {
  answerWarnings,
  domainOf,
  isWaiting,
  type AgentMetrics,
  type ResearchView,
  type TraceItem,
  type UISource,
} from "@/lib/research";
import { fetchRun, traceFromRun, viewFromRun, type RunData } from "@/lib/runs";
import { modelLabel } from "@/lib/models";
import { cn } from "@/lib/cn";

export const UNSUPPORTED_TIP = "The cited page does not contain this claim's figures";

/** Re-render every `ms` while `active`, so timers keep moving during long pauses. */
function useNow(active: boolean, ms = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;

// ---------------------------------------------------------------------------
// Trace panel
// ---------------------------------------------------------------------------

export function ResearchPanel({ view, streaming }: { view: ResearchView; streaming?: boolean }) {
  const running = !!streaming && !view.finishedAt;
  const now = useNow(running);
  // Open while running, collapsed once the answer is in, unless the user toggled it.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? running;
  const setOpen = (f: (o: boolean) => boolean) => setUserOpen(f(open));

  const elapsed = (view.finishedAt ?? now) - view.startedAt;
  const waiting = running && isWaiting(view);
  const lastStep = [...view.items].reverse().find((i) => i.step)?.step;
  const toolCount = view.items.filter((i) => i.kind === "act").length;

  const headline = running
    ? waiting
      ? "Waiting for rate limit…"
      : lastStep
        ? `Researching… step ${lastStep}`
        : "Starting research…"
    : view.metrics
      ? `Researched ${view.metrics.steps} steps, ${view.metrics.toolCalls} tool calls`
      : "Research ended";

  return (
    <div className="mb-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[12.5px]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
        aria-expanded={open}
      >
        {waiting ? (
          <Hourglass size={14} className="text-amber-500 animate-pulse" />
        ) : (
          <Telescope size={14} className={cn("text-[var(--accent)]", running && "animate-pulse")} />
        )}
        <span className={cn("font-medium", waiting && "text-amber-500")}>{headline}</span>
        {view.model && <span className="text-[var(--muted)] truncate">· {modelLabel(view.model)}</span>}
        <span className="ml-auto tabular-nums text-[var(--muted)]">{secs(elapsed)}</span>
        <ChevronDown size={14} className={cn("text-[var(--muted)] transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ol className="px-3.5 pb-3 space-y-1.5 max-h-[340px] overflow-y-auto">
          {view.items.length === 0 && <li className="text-[var(--muted)]">Planning the research…</li>}
          {view.items.map((item, i) => (
            <TraceLine key={i} item={item} isLast={i === view.items.length - 1} running={running} now={now} />
          ))}
          {!running && toolCount === 0 && view.items.length > 0 && (
            <li className="text-[var(--muted)]">No tools were called.</li>
          )}
        </ol>
      )}
    </div>
  );
}

function ToolIcon({ tool }: { tool?: string }) {
  const cls = "mt-0.5 shrink-0 text-[var(--accent)]";
  if (tool === "web_search") return <Search size={13} className={cls} />;
  if (tool === "read_page") return <BookOpen size={13} className={cls} />;
  if (tool === "save_note") return <NotebookPen size={13} className={cls} />;
  return <Globe size={13} className={cls} />;
}

function TraceLine({ item, isLast, running, now }: { item: TraceItem; isLast: boolean; running: boolean; now: number }) {
  const step = item.step ? <span className="text-[var(--muted)] tabular-nums w-5 shrink-0">{item.step}</span> : <span className="w-5 shrink-0" />;

  if (item.kind === "pause") {
    const active = isLast && running;
    const left = Math.max(0, (item.pauseMs ?? 0) - (now - item.at));
    return (
      <li className="flex gap-2 text-amber-500">
        <span className="w-5 shrink-0" />
        <Hourglass size={13} className={cn("mt-0.5 shrink-0", active && "animate-pulse")} />
        <span>
          {active
            ? `Waiting for rate limit… ${Math.ceil(left / 1000)}s`
            : `Waited for rate limit (${Math.round((item.pauseMs ?? 0) / 1000)}s)`}
        </span>
      </li>
    );
  }
  if (item.kind === "warning") {
    return (
      <li className="flex gap-2 text-amber-500">
        <span className="w-5 shrink-0" />
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        <span>{item.text}</span>
      </li>
    );
  }
  if (item.kind === "reason") {
    return (
      <li className="flex gap-2 text-[var(--muted)] italic">
        {step}
        <span className="line-clamp-2">{item.text}</span>
      </li>
    );
  }
  if (item.kind === "act") {
    return (
      <li className="flex gap-2">
        {step}
        <ToolIcon tool={item.tool} />
        <span className="min-w-0">
          <span className="inline-block px-1.5 mr-1 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[11px] font-medium text-[var(--foreground)]">
            {item.tool}
          </span>
          <span className="text-[var(--muted)] break-all">{item.text}</span>
        </span>
      </li>
    );
  }
  return <ObserveLine item={item} />;
}

/** Observation result; saved runs can expand to show the stored observation. */
function ObserveLine({ item }: { item: TraceItem }) {
  const [open, setOpen] = useState(false);
  const icon = item.ok ? (
    <CircleCheck size={13} className="mt-0.5 shrink-0 text-emerald-500" />
  ) : (
    <CircleX size={13} className="mt-0.5 shrink-0 text-red-400" />
  );
  const latency = item.latencyMs != null && (
    <span className="ml-auto pl-2 tabular-nums text-[var(--muted)]">{secs(item.latencyMs)}</span>
  );
  if (!item.detail) {
    return (
      <li className="flex gap-2">
        <span className="w-5 shrink-0" />
        {icon}
        <span className="min-w-0 text-[var(--muted)]">
          <span className="line-clamp-2">{item.text}</span>
        </span>
        {latency}
      </li>
    );
  }
  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title={open ? "Hide observation" : "Show observation"}
        className="w-full flex gap-2 text-left hover:text-[var(--foreground)]"
      >
        <span className="w-5 shrink-0" />
        {icon}
        <span className={cn("min-w-0 text-[var(--muted)]", !open && "line-clamp-2")}>{item.text}</span>
        <ChevronDown size={12} className={cn("mt-1 shrink-0 text-[var(--muted)] transition-transform", open && "rotate-180")} />
        {latency}
      </button>
      {open && (
        <pre className="ml-12 mt-1.5 mb-1 p-2.5 rounded-lg bg-[var(--background-elev)] border border-[var(--border)] text-[11px] leading-relaxed whitespace-pre-wrap break-words max-h-[260px] overflow-y-auto">
          {item.detail}
        </pre>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Answer with citation chips
// ---------------------------------------------------------------------------

export function ResearchAnswer({ text, view, streaming }: { text: string; view: ResearchView; streaming?: boolean }) {
  const answer = view.answer;
  // The harness appends a markdown Sources list; the Sources block below replaces it.
  const body = answer ? splitSources(text).body.trimEnd() : text;
  // Old runs have no report: every chip is "unchecked" (normal colour, still linked).
  const shown = answer ? annotateCitations(body, answer.report?.claims ?? []) : body;
  const byIndex = new Map((answer?.sources ?? []).map((s) => [s.index, s]));

  return (
    <Markdown
      text={shown}
      streaming={streaming}
      renderCitation={(n, status) => <CitationChip n={n} status={status} source={byIndex.get(n)} />}
    />
  );
}

function CitationChip({ n, status, source }: { n: number; status: string; source?: UISource }) {
  const unsupported = status === "unsupported";
  const title = unsupported
    ? UNSUPPORTED_TIP
    : source
      ? `${source.title} · ${domainOf(source.url)}`
      : "Source not retrieved in this run";
  return (
    <sup>
      <a
        href={source?.url}
        target="_blank"
        rel="noreferrer"
        title={title}
        aria-label={`Source ${n}${unsupported ? ` (${UNSUPPORTED_TIP})` : ""}`}
        // .markdown-body a underlines links (unlayered CSS beats Tailwind utilities).
        style={{ textDecoration: "none" }}
        className={cn(
          // Fixed box: inside <sup> the line box collapses and a border would cross the digit.
          "inline-flex items-center justify-center h-[16px] min-w-[16px] px-[4px] mx-[1px] rounded-[5px]",
          "text-[10.5px] leading-none font-semibold no-underline border align-[0.15em]",
          unsupported
            ? "text-amber-500 bg-amber-500/10 border-amber-500/40"
            : source
              ? "text-[var(--accent)] bg-[var(--accent-soft)] border-transparent"
              : "text-red-400 bg-red-500/10 border-red-500/40",
        )}
      >
        {n}
      </a>
    </sup>
  );
}

// ---------------------------------------------------------------------------
// Sources block
// ---------------------------------------------------------------------------

export function SourcesBlock({ view }: { view: ResearchView }) {
  const answer = view.answer;
  if (!answer || answer.sources.length === 0) return null;
  const readBacked = new Set(answer.report?.readBacked ?? []);
  const read = { has: (i: number) => answer.sources.find((s) => s.index === i)?.wasRead ?? readBacked.has(i) };
  return (
    <div className="mt-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-2">Sources</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {answer.sources.map((s) => (
          <li key={s.index}>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex items-start gap-2.5 p-2.5 rounded-xl border bg-[var(--card)] hover:bg-[var(--accent-soft)] transition no-underline",
                s.unsupported ? "border-amber-500/40" : "border-[var(--border)]",
              )}
              title={s.unsupported ? UNSUPPORTED_TIP : s.url}
            >
              <span className="text-[11px] font-semibold text-[var(--accent)] tabular-nums mt-0.5">{s.index}</span>
              <Favicon url={s.url} />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium leading-snug line-clamp-2 text-[var(--foreground)]">
                  {s.title}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-[var(--muted)]">
                  {domainOf(s.url)}
                  <Badge tone={read.has(s.index) ? "ok" : "muted"}>{read.has(s.index) ? "read" : "snippet only"}</Badge>
                  {s.unsupported && <Badge tone="warn">claims not found</Badge>}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The site's own /favicon.ico (no third-party favicon service); globe if it fails. */
function Favicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  let src = "";
  try {
    src = `${new URL(url).origin}/favicon.ico`;
  } catch {
    /* bad url */
  }
  if (!src || failed) return <Globe size={16} className="mt-0.5 shrink-0 text-[var(--muted)]" />;
  return (
    // A 16px external favicon in a component shared with the Vite SPA: next/image doesn't apply.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="mt-0.5 shrink-0 w-4 h-4 rounded-sm"
    />
  );
}

function Badge({ tone, children }: { tone: "ok" | "muted" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "px-1.5 py-[1px] rounded-full border text-[10px] leading-4",
        tone === "ok" && "text-emerald-500 border-emerald-500/40 bg-emerald-500/10",
        tone === "muted" && "text-[var(--muted)] border-[var(--border)]",
        tone === "warn" && "text-amber-500 border-amber-500/40 bg-amber-500/10",
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Metrics footer
// ---------------------------------------------------------------------------

/** Metrics footer. Old runs only have part of the metrics; missing values are left out. */
export function ResearchFooter({ view }: { view: ResearchView }) {
  const m: Partial<AgentMetrics> | undefined = view.metrics ?? view.partialMetrics;
  if (!m) return null;
  const support = view.answer?.report?.supportRate ?? m.supportRate;
  const label = (s: string) => s.replace(/_/g, " ");
  const status = !m.status
    ? null
    : m.status === "completed"
      ? "completed"
      : m.stoppedBy === "aborted"
        ? "stopped"
        : !m.stoppedBy || m.status === m.stoppedBy
          ? label(m.status)
          : `${label(m.status)} (${label(m.stoppedBy)})`;
  const notes = m.notesSaved != null ? m.notesSaved + (m.autoNotesSaved ?? 0) : null;

  const parts: React.ReactNode[] = [];
  if (m.latencyMs != null) parts.push(secs(m.latencyMs));
  if (m.steps != null) parts.push(`${m.steps}${m.maxSteps ? `/${m.maxSteps}` : ""} steps`);
  if (m.toolCalls != null) parts.push(`${m.toolCalls} tool calls`);
  if (m.tokens) parts.push(`${m.tokens.total.toLocaleString()} tokens`);
  if (m.pagesRead != null) parts.push(`${m.pagesRead} pages read`);
  if (notes != null) parts.push(`${notes} notes`);
  if (support !== undefined)
    parts.push(
      <span
        key="support"
        className={cn(support != null && support < 1 && "text-amber-500")}
        title={support != null && support < 1 ? "Some cited claims were not found in their source" : undefined}
      >
        support {support == null ? "—" : `${Math.round(support * 100)}%`}
      </span>,
    );
  if (m.model) parts.push(m.model.replace(/^openrouter:/, "OpenRouter "));
  if (status)
    parts.push(
      <span key="status" className={cn(m.status !== "completed" && "text-amber-500")}>
        {status}
      </span>,
    );
  if (!parts.length) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-[var(--muted)] tabular-nums">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>·</span>}
          {p}
        </span>
      ))}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Warning banners
// ---------------------------------------------------------------------------

const MAX_BANNERS = 3;

export function WarningBanners({ view }: { view: ResearchView }) {
  const [all, setAll] = useState(false);
  const warnings = answerWarnings(view);
  if (!warnings.length) return null;
  const shown = all ? warnings : warnings.slice(0, MAX_BANNERS);
  return (
    <div className="mt-3 space-y-1.5" role="status">
      {shown.map((w, i) => (
        <div
          key={i}
          className="flex gap-2 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500 text-[12px] leading-snug"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{w}</span>
        </div>
      ))}
      {warnings.length > MAX_BANNERS && (
        <button onClick={() => setAll((a) => !a)} className="text-[11.5px] text-[var(--muted)] hover:text-[var(--foreground)]">
          {all ? "Show fewer warnings" : `Show ${warnings.length - MAX_BANNERS} more warning(s)`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved runs: lazy load, answer from history, "View research trace"
// ---------------------------------------------------------------------------

/** Load a run when `enabled`. `loading` is true until the result for this id arrives. */
function useRun(id: string | null | undefined, enabled: boolean) {
  const [res, setRes] = useState<{ id: string; run: RunData | null } | null>(null);
  useEffect(() => {
    if (!enabled || !id) return;
    let alive = true;
    void fetchRun(id).then((run) => {
      if (alive) setRes({ id, run });
    });
    return () => {
      alive = false;
    };
  }, [id, enabled]);
  const current = res && res.id === id ? res : null;
  return { run: current?.run ?? null, loading: enabled && !!id && !current };
}

/**
 * Everything below the "NEXORA · Research" label for one answer:
 * - while the run is live: the live trace panel and the streaming answer;
 * - once finished (live or reloaded): cited answer, warnings, Sources, footer
 *   and a "View research trace" button that loads the saved trace.
 */
export function ResearchMessage({
  text,
  streaming,
  live,
  runId,
}: {
  text: string;
  streaming?: boolean;
  live?: ResearchView;
  runId?: string | null;
}) {
  const [traceOpen, setTraceOpen] = useState(false);
  const running = !!streaming && !!live && !live.finishedAt;
  const id = runId ?? live?.runId ?? null;
  // Reloaded answers need the run for everything; live ones only for the trace button.
  const { run, loading } = useRun(id, (!live && !!id) || traceOpen);
  const history = useMemo(() => (!live && run ? viewFromRun(run, text) : undefined), [live, run, text]);
  const view = live ?? history;

  if (running && live) {
    return (
      <>
        <ResearchPanel view={live} streaming={streaming} />
        {text && <ResearchAnswer text={text} view={live} streaming={streaming} />}
      </>
    );
  }

  return (
    <>
      {view ? (
        <>
          <ResearchAnswer text={text} view={view} />
          <WarningBanners view={view} />
          <SourcesBlock view={view} />
          <ResearchFooter view={view} />
        </>
      ) : (
        // Loading (or run deleted): the saved answer without its markdown Sources list.
        <>
          <Markdown text={splitSources(text).body.trimEnd()} />
          {loading && <p className="mt-2 text-[11.5px] text-[var(--muted)]">Loading research details…</p>}
        </>
      )}
      {id && (
        <div className="mt-3">
          <button
            onClick={() => setTraceOpen((o) => !o)}
            aria-expanded={traceOpen}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[var(--border)] text-[12px] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition"
          >
            <ListTree size={13} /> {traceOpen ? "Hide research trace" : "View research trace"}
          </button>
          {traceOpen && <ResearchTrace run={run} loading={loading} answerText={text} />}
        </div>
      )}
    </>
  );
}

/** The saved Reason / Act / Observe timeline for a finished run (no live timer). */
function ResearchTrace({ run, loading, answerText }: { run: RunData | null; loading: boolean; answerText: string }) {
  const items = useMemo(() => (run ? traceFromRun(run) : []), [run]);
  const view = useMemo(() => (run ? viewFromRun(run, answerText) : undefined), [run, answerText]);
  if (loading) return <p className="mt-2 text-[12px] text-[var(--muted)]">Loading research trace…</p>;
  if (!run || !view) return <p className="mt-2 text-[12px] text-red-400">This research run is no longer available.</p>;

  const elapsed = (run.finishedAt ?? run.startedAt) - run.startedAt;
  return (
    <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[12.5px]">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-[var(--border)]">
        <Telescope size={14} className="text-[var(--accent)]" />
        <span className="font-medium shrink-0">Research trace</span>
        <span className="text-[var(--muted)] shrink-0">· {modelLabel(run.model)}</span>
        <span className="text-[var(--muted)] truncate">· {run.question}</span>
        <span className="ml-auto tabular-nums text-[var(--muted)]">{secs(run.totalLatencyMs ?? elapsed)}</span>
      </div>
      <ol className="px-3.5 py-3 space-y-1.5 max-h-[420px] overflow-y-auto">
        {items.length === 0 && <li className="text-[var(--muted)]">No steps were saved for this run.</li>}
        {items.map((item, i) => (
          <TraceLine key={i} item={item} isLast={false} running={false} now={0} />
        ))}
        {run.cancelled && (
          <li className="flex gap-2 text-amber-500">
            <span className="w-5 shrink-0" />
            <CircleX size={13} className="mt-0.5 shrink-0" />
            <span>Research stopped before an answer was produced.</span>
          </li>
        )}
        {!run.report && (
          <li className="text-[11px] text-[var(--muted)] pt-1">
            Saved before research reports were stored: reasoning and warnings are not available for this run.
          </li>
        )}
      </ol>
      <div className="px-3.5 pb-3">
        <ResearchFooter view={view} />
      </div>
    </div>
  );
}
