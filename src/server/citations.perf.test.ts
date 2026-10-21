/**
 * Guard against catastrophic regex backtracking: the citation / Sources code
 * runs on partial, streaming, model-written text, so every function must be
 * (near-)linear even on pathological input.
 */
import { describe, expect, it } from "vitest";
import {
  analyzeCitations,
  annotateCitations,
  checkClaim,
  enforceSupport,
  normalizeCitations,
  splitSources,
  withHarnessSources,
} from "./citations";
import { splitMarkdownBlocks } from "@/lib/markdownBlocks";

const N = 20_000;
const LIMIT_MS = 15; // "a few milliseconds" on a 20k-char input, after warm-up

const page = "Llama-3.3-70B-SpecDec\nInput Token Price | $0.59 per 1M tokens |\n" + "filler text ".repeat(500);
const registry = { get: (i: number) => (i <= 3 ? { url: `https://x.dev/${i}`, wasRead: true, text: page } : undefined) };
const seen = new Set(["https://x.dev/1", "https://x.dev/2", "https://x.dev/3"]);

/** Pathological partial inputs (what a stream can look like mid-delta). */
const INPUTS: Record<string, string> = {
  "unterminated table row": "| Year | Model |\n|---|---|\n| **201" + "| **x ".repeat(N / 6) + "[1",
  "repeated asterisks": "*".repeat(N),
  "asterisks + spaces": "* ".repeat(N / 2) + "x",
  "very long line of spaces then text": "Sources" + " ".repeat(N) + "x",
  "long whitespace run before non-punctuation": "claim [1]" + " ".repeat(N) + "x",
  "trailing whitespace": "answer text [1]." + " ".repeat(N),
  "unclosed gpt-oss citation": "【1†" + "a".repeat(N),
  "many unclosed citations": "【1† ".repeat(N / 4),
  "unclosed (unverified": "(unverified " + "b".repeat(N) + " [1]",
  "unclosed [n with spaces": ("[1" + " ".repeat(40)).repeat(N / 42),
  "digit groups": "1,000 ".repeat(N / 6) + "[1]",
  "long digit run": "9".repeat(N) + " [1]",
  "very long single line": ("Llama 3.3 70B costs $0.59 per 1M tokens [1] and GPT-OSS ").repeat(N / 60),
};

function time(fn: () => unknown): number {
  fn(); // warm-up (JIT)
  const t = performance.now();
  fn();
  return performance.now() - t;
}

describe("citation code is linear on pathological partial text", () => {
  for (const [name, text] of Object.entries(INPUTS)) {
    it(name, () => {
      const steps: Record<string, () => unknown> = {
        splitSources: () => splitSources(text),
        normalizeCitations: () => normalizeCitations(text),
        analyzeCitations: () => analyzeCitations(text, registry, seen),
        annotateCitations: () => annotateCitations(text, []),
        enforceSupport: () => enforceSupport(text, registry),
        withHarnessSources: () => withHarnessSources(text, [{ index: 1, url: "https://x.dev/1", title: "x" }]),
        checkClaim: () => checkClaim(text.slice(0, 2000), page),
        splitMarkdownBlocks: () => splitMarkdownBlocks(text),
      };
      const slow = Object.entries(steps)
        .map(([fn, run]) => [fn, time(run)] as const)
        .filter(([, ms]) => ms > LIMIT_MS)
        .map(([fn, ms]) => `${fn} ${ms.toFixed(1)}ms`);
      expect(slow, `slow on "${name}" (${text.length} chars)`).toEqual([]);
    });
  }
});
