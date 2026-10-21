/**
 * Render eval/results.json as Markdown (eval/results.md).
 *
 * Only VALID NEXORA rows are evaluated: rows that used the provider fallback
 * or hit a Groq 429 ("invalid_rate_limited") and errored rows are listed
 * separately and never enter accuracy, latency, token or other averages.
 * Baseline numbers are kept only for questions with a valid NEXORA row, so
 * the comparison is like-for-like.
 */
import type { EvalQuestion } from "./score";
import type { BaselineResult, NexoraResult, QuestionResult, ResultsFile } from "./run";
import { rowKind } from "./validity";

const pct = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "—" : `${Math.round(x * 100)}%`);
const num = (x: number | null | undefined, d = 0) => (x == null || !Number.isFinite(x) ? "—" : x.toFixed(d));
const secs = (ms: number | null | undefined) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);
const mean = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const rate = <T>(xs: T[], pred: (x: T) => boolean) => (xs.length ? xs.filter(pred).length / xs.length : null);
const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const short = (s: string, n = 70) => esc(s.length > n ? `${s.slice(0, n - 3)}…` : s);

function correctCell(c: { correct: boolean; method: string; score: number } | undefined, judge?: { score: number }) {
  if (!c) return "—";
  const base =
    c.method === "f1"
      ? `F1 ${c.score.toFixed(2)} ${c.correct ? "✅" : "❌"}`
      : c.score > 0 && c.score < 1
        ? `${c.correct ? "✅" : "❌"} (${Math.round(c.score * 100)}% of key figures)`
        : c.correct
          ? "✅"
          : "❌";
  return judge ? `${base} · judge ${judge.score}/5` : base;
}

export interface Aggregates {
  n: number;
  accuracy: number | null;
  meanScore: number | null;
  avgLatencyMs: number | null;
  avgToolCalls?: number | null;
  avgTokens: number | null;
  citationPrecision?: number | null;
  supportRate?: number | null;
  readRatio?: number | null;
  completionRate?: number | null;
  stepLimitRate?: number | null;
  judge?: number | null;
}

/** Aggregate VALID NEXORA rows only (callers must filter). */
export function aggregateNexora(rows: NexoraResult[]): Aggregates {
  return {
    n: rows.length,
    accuracy: rate(rows, (r) => !!r.correctness?.correct),
    meanScore: mean(rows.map((r) => r.correctness?.score)),
    avgLatencyMs: mean(rows.map((r) => r.latencyMs)),
    avgToolCalls: mean(rows.map((r) => r.toolCalls)),
    avgTokens: mean(rows.map((r) => r.tokens)),
    citationPrecision: mean(rows.map((r) => r.citationPrecision)),
    supportRate: mean(rows.map((r) => r.supportRate)),
    readRatio: mean(rows.map((r) => r.readRatio)),
    completionRate: rate(rows, (r) => r.status === "completed"),
    stepLimitRate: rate(rows, (r) => r.status === "step_limit"),
    judge: mean(rows.map((r) => r.judge?.normalized)),
  };
}

/** Aggregate baselines (errored baseline calls are excluded from latency/tokens, counted wrong for accuracy). */
export function aggregateBaseline(rows: BaselineResult[]): Aggregates {
  const ok = rows.filter((r) => !r.error);
  return {
    n: rows.length,
    accuracy: rate(rows, (r) => r.correctness.correct),
    meanScore: mean(rows.map((r) => r.correctness.score)),
    avgLatencyMs: mean(ok.map((r) => r.latencyMs)),
    avgTokens: mean(ok.map((r) => r.tokens)),
    judge: mean(rows.map((r) => r.judge?.normalized)),
  };
}

export function renderMarkdown(file: ResultsFile, questions: EvalQuestion[]): string {
  const order = new Map(questions.map((q, i) => [q.id, i]));
  const rows: QuestionResult[] = Object.values(file.results)
    .filter((r) => r.nexora)
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  const valid = rows.filter((r) => rowKind(r) === "valid");
  const invalid = rows.filter((r) => rowKind(r) === "invalid");
  const errored = rows.filter((r) => rowKind(r) === "error");
  const allRuns = rows.map((r) => r.nexora!);

  const A = aggregateNexora(valid.map((r) => r.nexora!));
  // Like-for-like: baseline only for questions that have a valid NEXORA row.
  const baseRows = valid.flatMap((r) => (r.baseline ? [r.baseline] : []));
  const B = aggregateBaseline(baseRows);

  const out: string[] = [];
  out.push("# NEXORA evaluation results", "");
  out.push(
    `**${valid.length} valid / ${rows.length} run** (of ${questions.length} questions) · model \`${file.meta.model}\` · ` +
      `updated ${file.meta.updatedAt.replace("T", " ").slice(0, 16)} UTC`,
    "",
  );
  if (invalid.length || errored.length)
    out.push(
      `> ${invalid.length} run(s) not evaluated because of rate limits${errored.length ? ` and ${errored.length} errored` : ""}. ` +
        "They are excluded from every number below and are retried automatically by `npm run eval`.",
      "",
    );
  out.push(
    "Correctness: short answers use normalized exact match or contains-match against the ground truth; questions with " +
      "`match: all` need every key figure (partial credit shown); other comprehensive answers use token-level F1 against a " +
      "reference (correct at F1 ≥ 0.35). Baseline = the same model answering once with no tools.",
    "",
  );

  out.push("## Evaluated questions", "");
  if (!valid.length) out.push("_No valid rows yet._", "");
  else {
    out.push(
      "| # | Question | Category | NEXORA | Baseline | Status | Latency | Steps | Tools | Tokens | Precision | Support | Read ratio | Snippet-only |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    );
    valid.forEach((r, i) => {
      const n = r.nexora!;
      const b = r.baseline;
      out.push(
        `| ${i + 1} | ${short(r.question)} | ${r.category.replace(/_/g, " ")} | ${correctCell(n.correctness, n.judge)} | ` +
          `${b ? (b.error ? "error" : correctCell(b.correctness, b.judge)) : "—"} | ${n.status} | ${secs(n.latencyMs)} | ` +
          `${num(n.steps)} | ${num(n.toolCalls)} | ${num(n.tokens)} | ${pct(n.citationPrecision)} | ${pct(n.supportRate)} | ` +
          `${pct(n.readRatio)} | ${num(n.snippetOnlyCount)} |`,
      );
    });
    out.push("");
  }

  if (invalid.length) {
    out.push("## Not evaluated (rate limited)", "");
    out.push("| Question | Category | Reason |", "|---|---|---|");
    for (const r of invalid) {
      const reason = r.nexora!.invalidReason ?? "rate limited";
      const kind = /per day|\bTPD\b|\bRPD\b/i.test(reason) ? "Groq daily token limit (TPD); fell back to a model without tools" : "rate limited / fallback used";
      out.push(`| ${short(r.question)} | ${r.category.replace(/_/g, " ")} | ${kind} |`);
    }
    out.push("");
  }
  if (errored.length) {
    out.push("## Not evaluated (error)", "");
    out.push("| Question | Error |", "|---|---|");
    for (const r of errored) out.push(`| ${short(r.question)} | ${short(r.nexora!.error ?? "", 90)} |`);
    out.push("");
  }

  out.push("## Aggregate (NEXORA, valid rows only)", "");
  out.push("| Metric | Value |", "|---|---|");
  const agg: [string, string][] = [
    ["Valid rows", `${valid.length} of ${rows.length} run`],
    ["Accuracy", pct(A.accuracy)],
    ["Mean correctness score", num(A.meanScore, 2)],
    ["Avg latency", secs(A.avgLatencyMs)],
    ["Avg tool calls", num(A.avgToolCalls, 1)],
    ["Avg tokens", num(A.avgTokens)],
    ["Citation precision", pct(A.citationPrecision)],
    ["Support rate", pct(A.supportRate)],
    ["Read ratio", pct(A.readRatio)],
    ["Completion rate", pct(A.completionRate)],
    ["Step-limit rate", pct(A.stepLimitRate)],
    // Fallback rate by construction is 0% over valid rows; report it over all runs, clearly labelled.
    ["Fallback rate (all runs, incl. not evaluated)", pct(rate(allRuns, (n) => n.usedFallback))],
  ];
  if (A.judge != null) agg.push(["LLM judge (comprehensive, 0-1)", num(A.judge, 2)]);
  for (const [k, v] of agg) out.push(`| ${k} | ${v} |`);
  out.push("");

  out.push("## NEXORA vs baseline (same questions, same model, baseline has no tools)", "");
  out.push(`Compared on the ${valid.length} question(s) with a valid NEXORA row.`, "");
  out.push("| Metric | NEXORA | Baseline |", "|---|---|---|");
  out.push(`| Accuracy | ${pct(A.accuracy)} | ${pct(B.accuracy)} |`);
  out.push(`| Mean correctness score | ${num(A.meanScore, 2)} | ${num(B.meanScore, 2)} |`);
  out.push(`| Avg latency | ${secs(A.avgLatencyMs)} | ${secs(B.avgLatencyMs)} |`);
  out.push(`| Avg tokens | ${num(A.avgTokens)} | ${num(B.avgTokens)} |`);
  out.push(`| Cites retrieved sources | ${pct(A.citationPrecision)} precision | none |`);
  if (A.judge != null || B.judge != null) out.push(`| LLM judge (0-1) | ${num(A.judge, 2)} | ${num(B.judge, 2)} |`);
  for (const c of [...new Set(valid.map((r) => r.category))]) {
    const rs = valid.filter((r) => r.category === c);
    const a = rate(rs, (r) => !!r.nexora?.correctness?.correct);
    const withB = rs.filter((r) => r.baseline);
    const b = rate(withB, (r) => !!r.baseline?.correctness.correct);
    out.push(`| Accuracy: ${c.replace(/_/g, " ")} (${rs.length}) | ${pct(a)} | ${pct(b)} |`);
  }
  out.push("");
  return out.join("\n");
}
