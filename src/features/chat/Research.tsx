"use client";
/**
 * NEXORA research answer UI: live trace panel, cited answer, Sources block
 * and metrics footer. Driven by the ResearchView built from agent frames.
 */
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  CircleCheck,
  CircleX,
  Globe,
  Hourglass,
  NotebookPen,
  Search,
  Telescope,
} from "lucide-react";
import { Markdown } from "@/components/ui/Markdown";
import { annotateCitations, splitSources } from "@/server/citations";
import { domainOf, isWaiting, type ResearchView, type SourceRef, type TraceItem } from "@/lib/research";
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
          <span className="font-medium">{item.tool}</span>{" "}
          <span className="text-[var(--muted)] break-all">{item.text}</span>
        </span>
      </li>
    );
  }
  // observe
  return (
    <li className="flex gap-2">
      <span className="w-5 shrink-0" />
      {item.ok ? (
        <CircleCheck size={13} className="mt-0.5 shrink-0 text-emerald-500" />
      ) : (
        <CircleX size={13} className="mt-0.5 shrink-0 text-red-400" />
      )}
      <span className="min-w-0 text-[var(--muted)]">
        <span className="line-clamp-2">{item.text}</span>
      </span>
      {item.latencyMs != null && <span className="ml-auto pl-2 tabular-nums text-[var(--muted)]">{secs(item.latencyMs)}</span>}
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
  const shown = answer ? annotateCitations(body, answer.report.claims) : body;
  const byIndex = new Map((answer?.sources ?? []).map((s) => [s.index, s]));

  return (
    <Markdown
      text={shown}
      streaming={streaming}
      renderCitation={(n, status) => <CitationChip n={n} status={status} source={byIndex.get(n)} />}
    />
  );
}

function CitationChip({ n, status, source }: { n: number; status: string; source?: SourceRef }) {
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
  const read = new Set(answer.report.readBacked);
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

export function ResearchFooter({ view }: { view: ResearchView }) {
  const m = view.metrics;
  if (!m) return null;
  const support = view.answer?.report.supportRate ?? m.supportRate;
  const notes = m.notesSaved + (m.autoNotesSaved ?? 0);
  const label = (s: string) => s.replace(/_/g, " ");
  const status =
    m.status === "completed"
      ? "completed"
      : m.stoppedBy === "aborted"
        ? "stopped"
        : m.status === m.stoppedBy
          ? label(m.status)
          : `${label(m.status)} (${label(m.stoppedBy)})`;
  const parts: React.ReactNode[] = [
    secs(m.latencyMs),
    `${m.steps} steps`,
    `${m.toolCalls} tool calls`,
    `${m.tokens?.total.toLocaleString() ?? "—"} tokens`,
    `${m.pagesRead} pages read`,
    `${notes} notes`,
    <span
      key="support"
      className={cn(support != null && support < 1 && "text-amber-500")}
      title={support != null && support < 1 ? "Some cited claims were not found in their source" : undefined}
    >
      support {support == null ? "—" : `${Math.round(support * 100)}%`}
    </span>,
    m.model.replace(/^openrouter:/, "OpenRouter "),
    <span key="status" className={cn(m.status !== "completed" && "text-amber-500")}>
      {status}
    </span>,
  ];
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
