/** Landing copy shared by the Vite landing page and the Next home page. */

export const BRAND = "NEXORA";
export const TAGLINE = "Autonomous Research & Evidence Agent";
export const CREDIT = "PICT Pune, Dept. of IT, Group TY_10-9";
export const DISCLAIMER = "Independent student project. Not affiliated with any AI model provider.";

export const HERO_COPY =
  "Ask a question and NEXORA plans the research itself: it searches the web, reads the pages, " +
  "saves the key facts as notes and writes an answer where every claim is cited and checked against the page it came from.";

export const FEATURES = [
  {
    key: "research",
    title: "Multi-step web research",
    body: "A ReAct loop decomposes your question, searches, reads full pages and iterates until it has evidence, or says what it could not find.",
  },
  {
    key: "trace",
    title: "Live tool-use traces",
    body: "Watch every Reason → Act → Observe step as it happens: tool, arguments, latency and result. Reopen the full trace from history at any time.",
  },
  {
    key: "citations",
    title: "Citation tracking",
    body: "Every claim cites [n] mapped to a page the agent actually retrieved. Claims whose figures are not on the cited page are flagged in amber.",
  },
  {
    key: "notes",
    title: "Persistent research notes",
    body: "Key verified facts are saved with their source URL in SQLite, alongside every step, source and metric of the run.",
  },
  {
    key: "guardrails",
    title: "Guardrails",
    body: "A step limit and token budget, web content treated as untrusted data, broken-page fallback, and citation checks on every answer.",
  },
] as const;

export const STEPS = [
  { title: "Reason", body: "Break the question into sub-questions and find the knowledge gap." },
  { title: "Act", body: "Call a tool: web_search, read_page or save_note." },
  { title: "Observe", body: "Ingest the result. Failed pages are reported back so another source is tried." },
  { title: "Iterate", body: "Repeat until the gap is closed or the step limit is reached." },
  { title: "Answer", body: "Write the answer with numbered citations, then check every [n] against its page." },
] as const;

export const GUARDRAILS = [
  "Step limit (8 by default) and a per-run token budget",
  "Web pages wrapped as untrusted data: instructions inside them are never followed",
  "Every citation must map to a URL that was actually retrieved",
  "Support check: the cited page must contain the claim's figures",
  "Broken-page fallback, loop guard and rate-limit pacing",
] as const;
