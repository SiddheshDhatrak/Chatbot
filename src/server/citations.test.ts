import { describe, expect, it } from "vitest";
import { analyzeCitations, checkClaim, citationWarnings, enforceSupport } from "./citations";

// What the agent "saw" for each source (page text if read, else snippet).
const LLAMA_PAGE =
  "Llama-3.3-70B-SpecDec - GroqDocs\nTechnical Details | Context Window (Tokens) | 8,192 |\n" +
  "Token Generation Speed | 1600 tokens per second |\nInput Token Price | $0.59 per 1M tokens |\n" +
  "Output Token Price | $0.99 per 1M tokens |\nBuilt on Meta's Llama 3.3 architecture with speculative decoding.";
const GPT_OSS_PAGE =
  "OpenAI GPT-OSS 120B - GroqDocs\nOpenAI's flagship open-weight MoE model with 120B total parameters.\n" +
  "PRICING | Input | $0.15 | 6.7M / $1 | Output | $0.60 | 1.7M / $1 |\nCONTEXT WINDOW | 131,072 |";

const sources: Record<number, { url: string; wasRead: boolean; text: string }> = {
  1: { url: "https://console.groq.com/docs/model/llama-3.3-70b-specdec", wasRead: true, text: LLAMA_PAGE },
  2: { url: "https://console.groq.com/docs/model/openai/gpt-oss-120b", wasRead: true, text: GPT_OSS_PAGE },
};
const registry = { get: (i: number) => sources[i] };
const seen = new Set(Object.values(sources).map((s) => s.url));

describe("claim-support check", () => {
  it("marks a claim supported when its numbers and names are in the cited source", () => {
    const answer = "Llama 3.3 70B SpecDec costs $0.59 per 1M input tokens and $0.99 per 1M output tokens [1].";
    const r = analyzeCitations(answer, registry, seen);
    expect(r.claims).toHaveLength(1);
    expect(r.claims[0]).toMatchObject({ index: 1, status: "supported", missingNumbers: [] });
    expect(r.supportRate).toBe(1);
    expect(r.unsupported).toEqual([]);
    expect(citationWarnings(r, { usedFallback: false, failed: false }).some((w) => /not supported/.test(w))).toBe(false);
  });

  it("handles formatted numbers in tables (8 192 vs 8,192, 131 072 vs 131,072)", () => {
    const answer = "| Context window | 8 192 tokens [1] | 131 072 tokens [2] |";
    const r = analyzeCitations(answer, registry, seen);
    expect(r.claims.map((c) => c.status)).toEqual(["supported", "supported"]);
  });

  it("marks a claim unsupported when a number is missing from the cited source", () => {
    // The real failure: a GPT-OSS price cited to the Llama page.
    const answer = "GPT-OSS 120B costs $0.15 per 1M input tokens [1].";
    const r = analyzeCitations(answer, registry, seen);
    expect(r.precision).toBe(1); // provenance is fine: [1] was retrieved...
    expect(r.claims[0]!.status).toBe("unsupported"); // ...but the page doesn't say this
    expect(r.claims[0]!.missingNumbers).toEqual(expect.arrayContaining(["120", "0.15"]));
    expect(r.unsupported).toEqual([1]);
    expect(r.supportRate).toBe(0);
    const warnings = citationWarnings(r, { usedFallback: false, failed: false });
    expect(warnings.some((w) => /not supported by their source \[1\]/.test(w))).toBe(true);
  });

  it("checks a citation-only 'Source' table cell against its whole row", () => {
    const good = "| GPT-OSS 120B (Groq) | 131,072 | [2] |";
    const bad = "| GPT-OSS 120B (Groq) | 131,072 | [1] |";
    expect(analyzeCitations(good, registry, seen).claims[0]!.status).toBe("supported");
    expect(analyzeCitations(bad, registry, seen).claims[0]!.status).toBe("unsupported");
  });

  it("treats a claim with nothing checkable as unchecked (not counted in supportRate)", () => {
    expect(checkClaim("it is fast and cheap", LLAMA_PAGE).status).toBe("unchecked");
  });
});

describe("citation repair safety net", () => {
  it("rejects a repaired citation the source does not support, keeping supported ones", () => {
    const repaired =
      "Llama 3.3 70B SpecDec has an 8,192-token context window [1]. " +
      "GPT-OSS 120B is a 120B-parameter MoE model [1].\n\n**Sources**\n\n[1] Llama - https://x";
    const { text, rejected } = enforceSupport(repaired, registry);

    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ index: 1, status: "unsupported" });
    // Supported sentence keeps its citation.
    expect(text).toContain("8,192-token context window [1].");
    // Unsupported sentence loses [1] and is marked.
    expect(text).toContain("GPT-OSS 120B is a 120B-parameter MoE model (unverified).");
    expect(text).not.toMatch(/MoE model \[1\]/);

    // After enforcement nothing unsupported remains cited.
    const r = analyzeCitations(text, registry, seen);
    expect(r.unsupported).toEqual([]);
    expect(r.supportRate).toBe(1);
  });

  it("keeps the same claim when it is cited to the right source", () => {
    const repaired = "GPT-OSS 120B is a 120B-parameter MoE model [2].";
    const { text, rejected } = enforceSupport(repaired, registry);
    expect(rejected).toEqual([]);
    expect(text).toBe(repaired);
  });
});
