/**
 * Correctness scoring for the NEXORA evaluation.
 *  - Short answers: normalized exact match, else contains-match against the
 *    acceptable answers ("any" by default, "all" when every part is required).
 *  - Long answers (comprehensive_synthesis): token-level F1 vs the reference
 *    (SQuAD-style bag of words, stopwords removed). Counted correct at F1 >= 0.35.
 * Citation markers and the Sources list are stripped before scoring.
 */
import { normalizeCitations, splitSources } from "../src/server/citations";

export interface EvalQuestion {
  id: string;
  category: "multi_hop" | "conflicting_sources" | "time_sensitive" | "single_fact" | "comprehensive_synthesis";
  question: string;
  /**
   * A string, or a list. With match "any" (default) any item counts. With "all"
   * every item is required, and an item may itself be a list of alternatives
   * (e.g. ["131,072", "131K"]).
   */
  groundTruth: string | (string | string[])[];
  /** For array ground truths: "any" acceptable answer (default) or "all" parts required. */
  match?: "any" | "all";
  notes?: string;
}

export interface Correctness {
  method: "exact" | "contains" | "f1";
  /** 0..1: 1/0 for short answers, the F1 value for long ones. */
  score: number;
  correct: boolean;
  /** Ground-truth items found in the answer (short answers). */
  matched?: string[];
}

export const F1_CORRECT = 0.35;

const STOP = new Set(
  "a an the and or of to in on for with by is are was were be been being it its this that these those as at from per about into than then so such which who whom whose what when where how why do does did can could will would should may might also not no but if".split(
    " ",
  ),
);

/** Lowercase, unify dashes, join thousands separators, drop punctuation (keeps decimals). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/(\d)[,  ](?=\d{3}(?!\d))/g, "$1")
    .replace(/[$€£₹]/g, " ")
    .replace(/[^a-z0-9.\s-]/g, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ") // keep "0.15" and "8848.86", drop sentence dots
    .replace(/\s+/g, " ")
    .trim();
}

/** The answer text without its Sources list and [n] citation markers. */
export function answerBody(answer: string): string {
  return splitSources(normalizeCitations(answer)).body.replace(/\[\d{1,3}\]/g, " ");
}

function containsTerm(haystack: string, needle: string): boolean {
  if (!needle) return false;
  // Word-ish boundaries so "2016" doesn't match "20160" and "128k" doesn't match "1128k".
  return ` ${haystack} `.includes(` ${needle} `) || new RegExp(`(?<![a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`).test(haystack);
}

const tokens = (s: string) => normalize(s).split(" ").filter((t) => t && !STOP.has(t));

/** SQuAD-style token F1. */
export function tokenF1(prediction: string, reference: string): number {
  const p = tokens(prediction);
  const r = tokens(reference);
  if (!p.length || !r.length) return 0;
  const counts = new Map<string, number>();
  for (const t of r) counts.set(t, (counts.get(t) ?? 0) + 1);
  let overlap = 0;
  for (const t of p) {
    const c = counts.get(t) ?? 0;
    if (c > 0) {
      overlap++;
      counts.set(t, c - 1);
    }
  }
  if (!overlap) return 0;
  const precision = overlap / p.length;
  const recall = overlap / r.length;
  return (2 * precision * recall) / (precision + recall);
}

export function scoreAnswer(q: EvalQuestion, answer: string): Correctness {
  const body = answerBody(answer ?? "");
  const keyFigures = q.match === "all" && Array.isArray(q.groundTruth);
  // Comprehensive answers: token F1 vs a reference text, unless the question
  // lists required key figures (match "all"), which are checked one by one.
  if (q.category === "comprehensive_synthesis" && !keyFigures) {
    const refs = (Array.isArray(q.groundTruth) ? q.groundTruth : [q.groundTruth]).flat();
    const f1 = Math.max(...refs.map((r) => tokenF1(body, r)));
    return { method: "f1", score: round3(f1), correct: f1 >= F1_CORRECT };
  }
  const norm = normalize(body);
  if (keyFigures) {
    // Every item required; an item may list alternatives. Partial credit in `score`.
    const items = (q.groundTruth as (string | string[])[]).map((g) => (Array.isArray(g) ? g : [g]));
    const matched = items.flatMap((alts) => alts.filter((a) => containsTerm(norm, normalize(a))).slice(0, 1));
    const found = items.filter((alts) => alts.some((a) => containsTerm(norm, normalize(a)))).length;
    return { method: "contains", score: round3(found / items.length), correct: found === items.length, matched };
  }
  const gts = (Array.isArray(q.groundTruth) ? q.groundTruth : [q.groundTruth]).flat();
  const exact = gts.some((g) => normalize(g) === norm);
  if (exact) return { method: "exact", score: 1, correct: true, matched: gts.filter((g) => normalize(g) === norm) };
  const matched = gts.filter((g) => containsTerm(norm, normalize(g)));
  return { method: "contains", score: matched.length > 0 ? 1 : 0, correct: matched.length > 0, matched };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
