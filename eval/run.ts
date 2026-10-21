/**
 * NEXORA evaluation runner.
 *
 *   npm run eval -- [--limit N] [--ids a,b,c] [--no-baseline] [--judge] [--force] [--report]
 *
 * For each question in eval/questions.json:
 *   - NEXORA: runs the research agent in-process (not via HTTP) with the default
 *     model and records answer, latency, steps, tool calls, tokens, status,
 *     fallback, citation precision, read ratio, support rate, snippet-only count
 *     and correctness;
 *   - baseline: same model, no tools, one plain answer (static-model comparison);
 *   - --judge: one LLM-as-judge score (1-5) for comprehensive_synthesis questions.
 * Results are written after every question to eval/results.json (resumable:
 * finished questions are skipped unless --force) and rendered to eval/results.md.
 * All runs are stored under one Session titled "NEXORA evaluation".
 */
import "dotenv/config";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "@/server/db";
import { runAgent, type AgentMetrics, type CitationReport } from "@/server/agent";
import { callGroqWithTools, groqTokenWaitMs, lastProviderFailure, onProviderFailure } from "@/server/groqTools";
import { SYSTEM_PROMPT } from "@/server/ai";
import { scoreAnswer, type Correctness, type EvalQuestion } from "./score";
import { renderMarkdown } from "./report";
import { INVALID_STATUS, is429, isDailyLimit, normalizeNexora } from "./validity";
import { makeGroq429Logger, type ErrorContext } from "./errorLog";

/** Thrown to end the whole run: the daily quota is gone, more calls would only fail or fall back. */
class DailyLimitStop extends Error {}

export const MODEL = "openai/gpt-oss-120b";
const EVAL_SESSION_TITLE = "NEXORA evaluation";
const DIR = typeof __dirname !== "undefined" ? __dirname : path.resolve("eval");
const QUESTIONS_FILE = path.join(DIR, "questions.json");
export const RESULTS_FILE = path.join(DIR, "results.json");
const MD_FILE = path.join(DIR, "results.md");
const ERRORS_FILE = path.join(DIR, "errors.log");
/** Which question / call is in flight, for eval/errors.log. */
const errorCtx: ErrorContext = { questionId: null, mode: null };

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface JudgeScore {
  score: number; // 1..5
  normalized: number; // 0..1
  reason: string;
}

export interface NexoraResult {
  answer: string;
  runId: string | null;
  latencyMs: number;
  steps: number;
  toolCalls: number;
  tokens: number | null;
  /** "invalid_rate_limited": fallback used or Groq 429; not scored, excluded, retried next run. */
  status: AgentMetrics["status"] | "error" | "invalid_rate_limited";
  invalidReason?: string;
  stoppedBy: string | null;
  usedFallback: boolean;
  citationPrecision: number | null;
  readRatio: number | null;
  supportRate: number | null;
  snippetOnlyCount: number;
  warnings: string[];
  /** Absent for invalid (rate-limited) rows: they are never scored. */
  correctness?: Correctness;
  judge?: JudgeScore;
  error?: string;
  finishedAt: string;
}

export interface BaselineResult {
  answer: string;
  latencyMs: number;
  tokens: number | null;
  correctness: Correctness;
  judge?: JudgeScore;
  error?: string;
  finishedAt: string;
}

export interface QuestionResult {
  id: string;
  category: EvalQuestion["category"];
  question: string;
  groundTruth: EvalQuestion["groundTruth"];
  nexora?: NexoraResult;
  baseline?: BaselineResult;
}

export interface ResultsFile {
  meta: { model: string; sessionId: string | null; createdAt: string; updatedAt: string };
  results: Record<string, QuestionResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(...a);

function parseArgs(argv: string[]) {
  const get = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const limit = get("--limit");
  const ids = get("--ids");
  return {
    limit: limit ? Math.max(1, Number(limit)) : undefined,
    ids: ids ? ids.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    baseline: !argv.includes("--no-baseline"),
    judge: argv.includes("--judge"),
    force: argv.includes("--force"),
    /** Only re-render results.md from results.json: no API or database calls. */
    reportOnly: argv.includes("--report"),
  };
}

function loadResults(): ResultsFile {
  if (existsSync(RESULTS_FILE)) {
    try {
      const file = JSON.parse(readFileSync(RESULTS_FILE, "utf8")) as ResultsFile;
      // Older files may hold fallback rows recorded as "completed": mark them invalid.
      for (const r of Object.values(file.results)) if (r.nexora) r.nexora = normalizeNexora(r.nexora);
      return file;
    } catch {
      log("! results.json is unreadable; starting a new one (old file kept as results.json.bak)");
      renameSync(RESULTS_FILE, `${RESULTS_FILE}.bak`);
    }
  }
  const now = new Date().toISOString();
  return { meta: { model: MODEL, sessionId: null, createdAt: now, updatedAt: now }, results: {} };
}

/** Atomic write: a crash mid-write never corrupts results.json. */
function save(file: ResultsFile, questions: EvalQuestion[], touch = true) {
  if (touch) file.meta.updatedAt = new Date().toISOString();
  writeFileSync(`${RESULTS_FILE}.tmp`, JSON.stringify(file, null, 2));
  renameSync(`${RESULTS_FILE}.tmp`, RESULTS_FILE);
  writeFileSync(MD_FILE, renderMarkdown(file, questions));
}

/** Wait until about `tokens` fit in Groq's tokens-per-minute window. */
async function paceFor(tokens: number) {
  const wait = groqTokenWaitMs(tokens);
  if (wait > 0) {
    log(`  … waiting ${Math.ceil(wait / 1000)}s for Groq's tokens-per-minute window`);
    await sleep(wait);
  }
}

async function evalSessionId(file: ResultsFile): Promise<string> {
  const existing =
    (file.meta.sessionId && (await db.session.findUnique({ where: { id: file.meta.sessionId } }))) ||
    (await db.session.findFirst({ where: { title: EVAL_SESSION_TITLE }, orderBy: { createdAt: "asc" } }));
  const session = existing ?? (await db.session.create({ data: { title: EVAL_SESSION_TITLE } }));
  file.meta.sessionId = session.id;
  return session.id;
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------------------
// NEXORA (agent) and baseline (no tools)
// ---------------------------------------------------------------------------

async function runNexora(q: EvalQuestion, sessionId: string): Promise<NexoraResult> {
  const t0 = Date.now();
  let answer = "";
  let runId: string | null = null;
  let report: CitationReport | null = null;
  let metrics: AgentMetrics | null = null;
  const warnings: string[] = [];
  try {
    for await (const ev of runAgent({ question: q.question, sessionId, model: MODEL })) {
      if (ev.type === "run_start") runId = ev.runId;
      else if (ev.type === "act") log(`    ${ev.step}. ${ev.tool} ${JSON.stringify(ev.args).slice(0, 90)}`);
      else if (ev.type === "warning") {
        warnings.push(ev.message);
        if (/^Pausing|limit|fallback|unavailable|stopped/i.test(ev.message)) log(`    ! ${ev.message.slice(0, 110)}`);
      } else if (ev.type === "answer") {
        answer = ev.text;
        report = ev.citationReport;
      } else if (ev.type === "done") metrics = ev.metrics;
    }
    // Keep the answer reachable in the UI: question + answer (with its trace) in the eval session.
    await db.message.create({ data: { sessionId, role: "user", content: q.question } });
    await db.message.create({ data: { sessionId, role: "assistant", content: answer || "(no answer)", runId } });
  } catch (e) {
    return normalizeNexora({
      answer,
      runId,
      latencyMs: Date.now() - t0,
      steps: 0,
      toolCalls: 0,
      tokens: null,
      status: "error",
      stoppedBy: null,
      usedFallback: false,
      citationPrecision: null,
      readRatio: null,
      supportRate: null,
      snippetOnlyCount: 0,
      warnings,
      correctness: scoreAnswer(q, answer),
      error: errText(e),
      finishedAt: new Date().toISOString(),
    });
  }
  const m = metrics as AgentMetrics | null;
  const r = report as CitationReport | null;
  // Fallback / 429 runs become "invalid_rate_limited" and lose their score here.
  return normalizeNexora({
    answer,
    runId,
    latencyMs: m?.latencyMs ?? Date.now() - t0,
    steps: m?.steps ?? 0,
    toolCalls: m?.toolCalls ?? 0,
    tokens: m?.tokens?.total ?? null,
    status: m?.status ?? "error",
    stoppedBy: m?.stoppedBy ?? null,
    usedFallback: m?.usedFallback ?? false,
    citationPrecision: r?.precision ?? null,
    readRatio: r?.readRatio ?? null,
    supportRate: r?.supportRate ?? null,
    snippetOnlyCount: r?.snippetOnlyCount ?? 0,
    warnings,
    correctness: scoreAnswer(q, answer),
    ...(m ? {} : { error: "run ended without metrics" }),
    finishedAt: new Date().toISOString(),
  });
}

async function runBaseline(q: EvalQuestion): Promise<BaselineResult> {
  const t0 = Date.now();
  try {
    const r = await callGroqWithTools(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: q.question },
      ],
      [], // no tools: the model answers from what it already knows
      MODEL,
    );
    const answer = (r.message.content ?? "").trim();
    return {
      answer,
      latencyMs: Date.now() - t0,
      tokens: r.usage?.total_tokens ?? null,
      correctness: scoreAnswer(q, answer),
      finishedAt: new Date().toISOString(),
    };
  } catch (e) {
    return {
      answer: "",
      latencyMs: Date.now() - t0,
      tokens: null,
      correctness: scoreAnswer(q, ""),
      error: errText(e),
      finishedAt: new Date().toISOString(),
    };
  }
}

/** Optional LLM-as-judge (1-5) against the reference answer. */
async function judge(q: EvalQuestion, answer: string): Promise<JudgeScore | undefined> {
  if (!answer) return undefined;
  const reference = Array.isArray(q.groundTruth) ? q.groundTruth.join(" | ") : q.groundTruth;
  try {
    await paceFor(2500);
    errorCtx.mode = "judge";
    const r = await callGroqWithTools(
      [
        {
          role: "system",
          content:
            "You grade answers against a reference answer. Score 1-5 for factual correctness and completeness " +
            "relative to the reference (5 = fully correct and complete, 1 = wrong or missing). Ignore style and citations. " +
            'Reply with JSON only: {"score": <1-5>, "reason": "<one sentence>"}',
        },
        { role: "user", content: `Question: ${q.question}\n\nReference answer: ${reference}\n\nAnswer to grade:\n${answer.slice(0, 6000)}` },
      ],
      [],
      MODEL,
      { maxTokens: 400 },
    );
    const json = (r.message.content ?? "").match(/\{[\s\S]*\}/)?.[0];
    const parsed = json ? (JSON.parse(json) as { score?: number; reason?: string }) : null;
    const score = Math.min(5, Math.max(1, Math.round(Number(parsed?.score))));
    if (!Number.isFinite(score)) return undefined;
    return { score, normalized: (score - 1) / 4, reason: String(parsed?.reason ?? "") };
  } catch (e) {
    log(`    ! judge failed: ${errText(e)}`);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * If the latest provider failure (since `since`) is a daily quota, return its
 * full text. Per-day limits (TPD/RPD) or a retry time over ~5 minutes mean
 * every further call would fail or fall back, so the run must stop.
 */
function dailyLimitMessage(since: number, seenText = ""): string | null {
  const f = lastProviderFailure();
  const fresh = f && f.at >= since ? f : null;
  const full = fresh ? `${fresh.provider} ${fresh.status}: ${fresh.body}` : seenText;
  if (!full || !(is429(full) || fresh?.status === 429)) return null;
  return isDailyLimit(full, fresh?.retryAfterMs) ? full : null;
}

const isValidNexora = (n?: NexoraResult) => !!n && !n.error && n.status !== INVALID_STATUS;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const all = JSON.parse(readFileSync(QUESTIONS_FILE, "utf8")) as EvalQuestion[];

  if (args.reportOnly) {
    // No API or database calls: normalize results.json (rate-limited rows -> invalid) and re-render.
    const file = loadResults();
    save(file, all, false);
    log(`Re-rendered ${path.relative(process.cwd(), MD_FILE)} from ${path.relative(process.cwd(), RESULTS_FILE)} (no API calls).`);
    return;
  }

  // Every Groq 429 (including ones retried internally) -> eval/errors.log + first 300 chars on screen.
  onProviderFailure(makeGroq429Logger(ERRORS_FILE, errorCtx, (line) => log(line)));

  let questions = args.ids ? all.filter((q) => args.ids!.includes(q.id)) : all;
  if (args.limit) questions = questions.slice(0, args.limit);
  if (!questions.length) throw new Error("No questions selected (check --ids / --limit).");

  const file = loadResults();
  const sessionId = await evalSessionId(file);
  log(`NEXORA evaluation · model ${MODEL} · ${questions.length} question(s) · session "${EVAL_SESSION_TITLE}" (${sessionId})`);
  log(`  baseline: ${args.baseline ? "on" : "off"} · judge: ${args.judge ? "on" : "off"} · force: ${args.force}\n`);

  try {
    for (const [i, q] of questions.entries()) {
      const prev = file.results[q.id];
      // Invalid (rate-limited) and errored NEXORA rows are retried automatically.
      const doneNexora = !args.force && isValidNexora(prev?.nexora);
      const doneBaseline = !args.baseline || (!args.force && prev?.baseline && !prev.baseline.error);
      const doneJudge =
        !args.judge || q.category !== "comprehensive_synthesis" || (prev?.nexora?.judge && (!args.baseline || prev?.baseline?.judge));
      if (doneNexora && doneBaseline && doneJudge) {
        log(`[${i + 1}/${questions.length}] ${q.id}: already done (use --force to re-run)`);
        continue;
      }
      const entry: QuestionResult = file.results[q.id] ?? {
        id: q.id,
        category: q.category,
        question: q.question,
        groundTruth: q.groundTruth,
      };
      Object.assign(entry, { category: q.category, question: q.question, groundTruth: q.groundTruth });
      file.results[q.id] = entry;
      log(`[${i + 1}/${questions.length}] ${q.id} (${q.category})\n  Q: ${q.question}`);
      errorCtx.questionId = q.id;

      if (!doneNexora) {
        const since = Date.now();
        try {
          await paceFor(6000);
          errorCtx.mode = "nexora";
          entry.nexora = await runNexora(q, sessionId);
        } catch (e) {
          entry.nexora = normalizeNexora({
            ...(entry.nexora as NexoraResult),
            warnings: entry.nexora?.warnings ?? [],
            error: errText(e),
            status: "error",
            finishedAt: new Date().toISOString(),
          });
        }
        const n = entry.nexora!;
        if (n.status === INVALID_STATUS) {
          const daily = dailyLimitMessage(since, n.invalidReason ?? "");
          const f = lastProviderFailure();
          if (f && f.at >= since) n.invalidReason = `${f.provider} ${f.status}: ${f.body}`;
          log(`  NEXORA: NOT EVALUATED (rate limited) · ${(n.invalidReason ?? "").slice(0, 140)}`);
          save(file, all);
          if (daily) throw new DailyLimitStop(daily);
          log("  (retried on the next run; baseline skipped for this question)\n");
          continue; // no baseline/judge for a question without a valid NEXORA row
        }
        log(
          `  NEXORA: ${n.error ? `ERROR ${n.error.slice(0, 100)}` : n.status} · ${(n.latencyMs / 1000).toFixed(0)}s · ${n.toolCalls} tools · ` +
            `${n.tokens ?? "?"} tok · ${n.correctness?.correct ? "CORRECT" : "wrong"} (${n.correctness?.method} ${n.correctness?.score})`,
        );
        save(file, all);
      }
      if (!isValidNexora(entry.nexora)) {
        log("  (no valid NEXORA row: baseline skipped)\n");
        continue;
      }
      if (!doneBaseline) {
        const since = Date.now();
        await paceFor(3000);
        errorCtx.mode = "baseline";
        entry.baseline = await runBaseline(q);
        const b = entry.baseline;
        log(
          `  baseline: ${b.error ? `ERROR ${b.error.slice(0, 100)}` : "ok"} · ${(b.latencyMs / 1000).toFixed(1)}s · ${b.tokens ?? "?"} tok · ` +
            `${b.correctness.correct ? "CORRECT" : "wrong"} (${b.correctness.method} ${b.correctness.score})`,
        );
        save(file, all);
        const daily = b.error ? dailyLimitMessage(since, b.error) : null;
        if (daily) throw new DailyLimitStop(daily);
      }
      if (args.judge && q.category === "comprehensive_synthesis") {
        if (entry.nexora && !entry.nexora.judge) entry.nexora.judge = await judge(q, entry.nexora.answer);
        if (entry.baseline && !entry.baseline.judge) entry.baseline.judge = await judge(q, entry.baseline.answer);
        log(`  judge: NEXORA ${entry.nexora?.judge?.score ?? "-"}/5 · baseline ${entry.baseline?.judge?.score ?? "-"}/5`);
        save(file, all);
      }
      log("");
    }
  } catch (e) {
    if (!(e instanceof DailyLimitStop)) throw e;
    save(file, all);
    console.error("\nSTOPPED: the provider's daily limit was reached. No further NEXORA or baseline calls were made.");
    console.error("Full provider error:\n" + e.message + "\n");
    console.error("Re-run `npm run eval` after the limit resets; rate-limited rows will be retried automatically.");
    process.exitCode = 2;
    return;
  }

  save(file, all);
  log(`Wrote ${path.relative(process.cwd(), RESULTS_FILE)} and ${path.relative(process.cwd(), MD_FILE)}`);
}

main()
  .catch((e) => {
    console.error("eval crashed:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
