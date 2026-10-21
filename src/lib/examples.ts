/** Example research questions for the empty chat state (Research mode is turned on when one is picked). */
export interface ResearchExample {
  kind: "Multi-hop" | "Time-sensitive" | "Comparison" | "Single fact";
  icon: "hop" | "clock" | "compare" | "fact";
  question: string;
}

export const RESEARCH_EXAMPLES: ResearchExample[] = [
  {
    kind: "Multi-hop",
    icon: "hop",
    question: "Which lab released the gpt-oss models, and under what license are their weights published?",
  },
  {
    kind: "Time-sensitive",
    icon: "clock",
    question: "What is the current Groq API price per million input and output tokens for GPT-OSS 120B?",
  },
  {
    kind: "Comparison",
    icon: "compare",
    question: "Compare the context window and pricing of GPT-OSS 120B and GPT-OSS 20B on Groq.",
  },
  {
    kind: "Single fact",
    icon: "fact",
    question: "Who founded Groq and when?",
  },
];
