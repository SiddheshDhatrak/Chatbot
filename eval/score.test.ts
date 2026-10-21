import { describe, expect, it } from "vitest";
import { normalize, scoreAnswer, tokenF1, type EvalQuestion } from "./score";

const q = (over: Partial<EvalQuestion>): EvalQuestion => ({
  id: "t",
  category: "single_fact",
  question: "?",
  groundTruth: "x",
  ...over,
});

describe("eval scoring", () => {
  it("normalizes numbers, money and punctuation", () => {
    expect(normalize("Context: 131,072 tokens.")).toBe("context 131072 tokens");
    expect(normalize("$0.15 per 1M")).toBe("0.15 per 1m");
    expect(normalize("8,848.86 m")).toBe("8848.86 m");
  });

  it("contains-match ignores citations and the Sources list", () => {
    const answer = "Groq was founded in **2016** by Jonathan Ross [1].\n\n**Sources**\n\n[1] Groq - https://groq.com";
    const r = scoreAnswer(q({ groundTruth: ["Jonathan Ross", "2016"], match: "all" }), answer);
    expect(r).toMatchObject({ method: "contains", correct: true, score: 1 });
  });

  it("'all' fails when a part is missing; 'any' passes with one", () => {
    expect(scoreAnswer(q({ groundTruth: ["Jonathan Ross", "2016"], match: "all" }), "Founded by Jonathan Ross.").correct).toBe(false);
    expect(scoreAnswer(q({ groundTruth: ["Edison", "Swan"] }), "Usually credited to Thomas Edison.").correct).toBe(true);
  });

  it("matches on word boundaries, not substrings of numbers", () => {
    expect(scoreAnswer(q({ groundTruth: ["2016"] }), "In 20160 ...").correct).toBe(false);
    expect(scoreAnswer(q({ groundTruth: ["0.15"] }), "It costs $0.15 per million.").correct).toBe(true);
    expect(scoreAnswer(q({ groundTruth: ["131,072", "128k"] }), "a 131072-token window").correct).toBe(true);
  });

  it("key figures: every item required, alternatives allowed, partial credit in score", () => {
    const kq = q({
      category: "comprehensive_synthesis",
      match: "all",
      groundTruth: [["131,072", "131K"], "$0.15", "$0.60", "$0.075", "$0.30"],
    });
    const full = "Both have a 131K context window. 120B: $0.15 in / $0.60 out. 20B: $0.075 in / $0.30 out [1].";
    expect(scoreAnswer(kq, full)).toMatchObject({ method: "contains", correct: true, score: 1 });
    const partial = scoreAnswer(kq, "Context 131,072 tokens; 120B costs $0.15 input and $0.60 output.");
    expect(partial.correct).toBe(false);
    expect(partial.score).toBe(0.6);
  });

  it("exact match", () => {
    expect(scoreAnswer(q({ groundTruth: "2017" }), "2017.")).toMatchObject({ method: "exact", correct: true });
  });

  it("token F1 for long answers", () => {
    expect(tokenF1("the cat sat on the mat", "the cat sat on the mat")).toBe(1);
    expect(tokenF1("dogs bark", "cats meow")).toBe(0);
    const r = scoreAnswer(
      q({ category: "comprehensive_synthesis", groundTruth: "RAG retrieves documents and adds them to the prompt to ground the answer." }),
      "RAG retrieves relevant documents and adds them to the prompt so the answer is grounded [1].",
    );
    expect(r.method).toBe("f1");
    expect(r.score).toBeGreaterThan(0.5);
    expect(r.correct).toBe(true);
  });
});
