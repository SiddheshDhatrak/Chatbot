/**
 * NEXORA citation checking.
 *
 * Citation rule: every claim cites [n], and [n] must map to a URL the agent
 * actually retrieved in this run. The harness checks this AFTER the model
 * writes its answer, and flags anything that doesn't hold.
 *
 * Two levels:
 *  - Provenance (precision): does [n] point at a source we retrieved?
 *  - Support (supportRate): does that source's text actually contain the
 *    claim's numbers and model names? Deterministic, no extra LLM call.
 */
import { normalizeUrl } from "./tools/types"; // types only: keeps this module DB-free (and testable)

export interface SourceRef {
  index: number;
  url: string;
  title: string;
  /** True when at least one claim citing this source failed the support check (render amber). */
  unsupported?: boolean;
}

export type ClaimStatus = "supported" | "unsupported" | "unchecked";

/** One cited sentence (or table cell) checked against one source. */
export interface ClaimCheck {
  index: number;
  text: string;
  status: ClaimStatus;
  missingNumbers: string[];
  missingTerms: string[];
}

export interface CitationReport {
  /** Every [n] number that appears in the answer body. */
  cited: number[];
  /** Cited numbers that map to a source the agent actually retrieved. */
  valid: number[];
  /** Cited numbers that do NOT map to any retrieved source (flagged). */
  invalid: number[];
  /** Valid citations whose page was fully read with read_page (strong evidence). */
  readBacked: number[];
  /** Valid citations only seen as a search snippet (weak evidence). */
  snippetOnly: number[];
  /** How many cited sources are snippet-only. */
  snippetOnlyCount: number;
  /** How many times the answer itself marks a claim "(unverified, snippet only)". */
  unverifiedMarkers: number;
  /** Raw URLs written in the answer that were never retrieved (flagged). */
  unverifiedUrls: string[];
  /** Lines in the model's own Sources list where [n] points at the wrong URL (flagged). */
  sourceListMismatches: { index: number; listedUrl: string; actualUrl: string | null }[];
  /** valid / cited. null when the answer has no citations. Measures provenance only. */
  precision: number | null;
  /** readBacked / valid. null when nothing valid is cited. */
  readRatio: number | null;
  /** Per-claim support results (UI: render "unsupported" in amber). */
  claims: ClaimCheck[];
  /** Source numbers with at least one unsupported claim. */
  unsupported: number[];
  /** supported / checked claims. null when no cited claim had anything checkable. */
  supportRate: number | null;
}

/** What the checker needs to know about each source. `text` = what the agent saw (page text or snippet). */
export type Registry = { get(i: number): { url: string; wasRead: boolean; text?: string } | undefined };

const CITE_RE = /\[(\d{1,3}(?:\s*[,–-]\s*\d{1,3})*)\]/g;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Split the answer into body and the trailing "Sources" section (if any). */
export function splitSources(text: string): { body: string; sources: string } {
  const m = text.match(/^\s*(?:#{1,4}\s*)?\**\s*(?:sources|references)\s*\**\s*:?\s*\**\s*$/im);
  if (!m || m.index === undefined) return { body: text, sources: "" };
  return { body: text.slice(0, m.index), sources: text.slice(m.index) };
}

/** gpt-oss sometimes cites as 【3】 or 【3†L10-L20】; normalise to [3]. */
export function normalizeCitations(text: string): string {
  return text.replace(/【\s*(\d{1,3})(?:†[^】]*)?\s*】/g, "[$1]");
}

/** Numbers inside one citation marker: "1, 3" -> [1,3]; "2-4" -> [2,3,4]. */
function citationNumbers(inner: string): number[] {
  const out: number[] = [];
  for (const part of inner.split(",")) {
    const range = part.split(/[–-]/).map((x) => Number(x.trim()));
    if (range.length === 2 && range[1]! >= range[0]! && range[1]! - range[0]! <= 20) {
      for (let n = range[0]!; n <= range[1]!; n++) out.push(n);
    } else if (Number.isFinite(range[0])) out.push(range[0]!);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Claim-support check
// ---------------------------------------------------------------------------

/** Lowercase, unify dashes/spaces, drop "$" and digit-group separators ("131,072" / "131 072" -> "131072"). */
function normalizeForNumbers(s: string): string {
  let t = s
    .toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/[   ]/g, " ")
    .replace(/\$/g, " ");
  let prev = "";
  while (prev !== t) {
    prev = t;
    t = t.replace(/(\d)[ ,](?=\d{3}(?!\d))/g, "$1");
  }
  return t.replace(/\s+/g, " ");
}

/** Letters and digits only, for name matching ("GPT-OSS" ~ "gpt oss" ~ "gptoss"). */
const alnum = (s: string) => s.toLowerCase().replace(/[‐-―−]/g, "-").replace(/[^a-z0-9]/g, "");

const TERM_STOP = new Set(
  "api usd url id ok faq pdf json http https tps ai the this that these those both each input output price pricing prices context model models token tokens source sources note notes answer short details feature features unknown not none".split(
    " ",
  ),
);

/** Text of a claim with citation markers, markdown and list bullets removed. */
function claimText(unit: string): string {
  return unit
    .replace(CITE_RE, " ")
    .replace(/\(unverified[^)]*\)/gi, " ")
    .replace(/[*_`#>]/g, "")
    .replace(/^\s*(?:\d+[.)]|[-+•])\s+/, "")
    .trim();
}

export function extractNumbers(claim: string): string[] {
  const t = normalizeForNumbers(claim);
  return [...new Set(t.match(/\d+(?:\.\d+)?/g) ?? [])];
}

/**
 * Key tokens: model-name-like tokens (two+ capitals like "GPT-OSS", "MoE",
 * "GQA"; letters+digits like "70B", "gpt-oss-120b") and capitalized words
 * that are not the first word of the claim.
 */
export function extractTerms(claim: string): string[] {
  const words = claim.replace(/[‐-―−]/g, "-").match(/[A-Za-z][A-Za-z0-9]*(?:[-.][A-Za-z0-9]+)*/g) ?? [];
  const out = new Set<string>();
  words.forEach((w, i) => {
    const caps = (w.match(/[A-Z]/g) ?? []).length;
    const modelish = caps >= 2 || (/\d/.test(w) && /[A-Za-z]/.test(w)) || (w.includes("-") && caps >= 1);
    const capitalized = i > 0 && /^[A-Z][a-z]{3,}/.test(w);
    if ((modelish || capitalized) && !TERM_STOP.has(w.toLowerCase()) && alnum(w).length >= 2) out.add(w);
  });
  return [...out];
}

/** Does `sourceText` contain the claim's numbers and (most of) its key terms? */
export function checkClaim(claim: string, sourceText: string): Omit<ClaimCheck, "index" | "text"> {
  const numbers = extractNumbers(claim);
  const terms = extractTerms(claim);
  if (!numbers.length && !terms.length) return { status: "unchecked", missingNumbers: [], missingTerms: [] };

  const src = normalizeForNumbers(sourceText);
  const srcAlnum = alnum(sourceText);
  const missingNumbers = numbers.filter((n) => {
    const esc = n.replace(".", "\\.");
    // Integers need a right boundary ("70" must not match "700"); decimals only a left one,
    // because extracted page text sometimes glues the next figure on ("$0.156.7M").
    const re = n.includes(".") ? new RegExp(`(?<![\\d.])${esc}`) : new RegExp(`(?<![\\d.])${esc}(?![\\d])`);
    return !re.test(src);
  });
  const missingTerms = terms.filter((t) => !srcAlnum.includes(alnum(t)));
  const ok = missingNumbers.length === 0 && missingTerms.length * 2 <= terms.length;
  return { status: ok ? "supported" : "unsupported", missingNumbers, missingTerms };
}

/**
 * Visit every claim unit in the answer body that carries a citation: each
 * table cell, and each sentence of a prose line. `fn` gets the unit, its
 * source numbers, and the claim text to check: normally the unit itself, but
 * for a table cell holding only a citation (a "Source" column) it is the whole
 * row. `fn` may return a rewritten unit. Returns the rewritten body.
 */
function mapCitedUnits(body: string, fn: (unit: string, sources: number[], claim: string) => string): string {
  return body
    .split("\n")
    .map((line) => {
      if (/^\s*\|/.test(line)) {
        const rowClaim = claimText(line.replace(/\|/g, " "));
        return line
          .split("|")
          .map((cell) => {
            const ns = [...cell.matchAll(CITE_RE)].flatMap((m) => citationNumbers(m[1]!));
            if (!ns.length) return cell;
            const own = claimText(cell);
            return fn(cell, [...new Set(ns)], own || rowClaim);
          })
          .join("|");
      }
      const trailing = line.match(/\s*$/)![0]; // keep markdown hard breaks
      const content = line.slice(0, line.length - trailing.length);
      const sentences = content.split(/(?<=[.!?])\s+(?=[*_(\["A-Z0-9-])/);
      return (
        sentences
          .map((s) => {
            const ns = [...s.matchAll(CITE_RE)].flatMap((m) => citationNumbers(m[1]!));
            return ns.length ? fn(s, [...new Set(ns)], claimText(s)) : s;
          })
          .join(" ") + trailing
      );
    })
    .join("\n");
}

/** Support-check every cited claim against the text of the source(s) it cites. */
export function checkSupport(body: string, registry: Registry): ClaimCheck[] {
  const claims: ClaimCheck[] = [];
  mapCitedUnits(body, (unit, ns, text) => {
    // A claim citing several sources may draw on all of them.
    const known = ns.filter((n) => registry.get(n));
    const union = known.map((n) => registry.get(n)!.text ?? "").join("\n");
    const result = known.length
      ? checkClaim(text, union)
      : { status: "unchecked" as const, missingNumbers: [], missingTerms: [] };
    for (const n of known) claims.push({ index: n, text: text.slice(0, 200), ...result });
    return unit;
  });
  return claims;
}

/**
 * Safety net for the citation-repair step: keep a citation only where the
 * claim passes the support check. Otherwise drop its [n] and mark the claim
 * "(unverified)". Returns the rewritten text and what was rejected.
 */
export function enforceSupport(text: string, registry: Registry): { text: string; rejected: ClaimCheck[] } {
  const { body, sources } = splitSources(text);
  const rejected: ClaimCheck[] = [];
  const out = mapCitedUnits(body, (unit, ns, claim) => {
    const known = ns.filter((n) => registry.get(n));
    const union = known.map((n) => registry.get(n)!.text ?? "").join("\n");
    const result = known.length ? checkClaim(claim, union) : null;
    if (result && result.status !== "unsupported") return unit;
    for (const n of ns) rejected.push({ index: n, text: claim.slice(0, 200), ...(result ?? { status: "unsupported", missingNumbers: [], missingTerms: [] }) });
    const stripped = unit.replace(/\s*\[(\d{1,3}(?:\s*[,–-]\s*\d{1,3})*)\]/g, "").replace(/\s+([.,;:!?])/g, "$1");
    if (/\(unverified/i.test(stripped)) return stripped;
    const lead = stripped.match(/^\s*/)![0];
    const tail = stripped.match(/\s*$/)![0];
    const core = stripped.trim();
    const punct = core.match(/[.!?]*$/)![0];
    return `${lead}${core.slice(0, core.length - punct.length)} (unverified)${punct}${tail}`;
  });
  return { text: out + sources, rejected };
}

/**
 * For the UI: rewrite every [n] in the answer body as a markdown link
 * "[\[n\]](#cite-n-<status>)" where status is that occurrence's support check
 * result. Uses the same sentence/cell splitting as checkSupport, so the
 * status matches what the server reported for that exact claim.
 */
export function annotateCitations(body: string, claims: ClaimCheck[]): string {
  return mapCitedUnits(body, (unit, _ns, claim) => {
    const text = claim.slice(0, 200);
    return unit.replace(CITE_RE, (_m, inner: string) =>
      citationNumbers(inner)
        .map((n) => {
          const status = claims.find((c) => c.index === n && c.text === text)?.status ?? "unchecked";
          return `[\\[${n}\\]](#cite-${n}-${status})`;
        })
        .join(""),
    );
  });
}

// ---------------------------------------------------------------------------
// Sources list + full report
// ---------------------------------------------------------------------------

/**
 * Replace the model's Sources section with one built by the harness from the
 * registry, so every [n] is listed with the URL that was really retrieved.
 */
export function withHarnessSources(text: string, sources: (SourceRef & { wasRead?: boolean })[]): string {
  const body = splitSources(text).body.replace(/\s*(?:-{3,}|\*{3,})\s*$/, "").trimEnd();
  if (!sources.length) return body;
  const list = sources
    .map(
      (s) =>
        `[${s.index}] ${s.title} - ${s.url}${s.wasRead === false ? " (snippet only)" : ""}` +
        (s.unsupported ? " (some claims not found in this source)" : ""),
    )
    .join("  \n");
  return `${body}\n\n**Sources**\n\n${list}`;
}

export function analyzeCitations(text: string, registry: Registry, seenUrls: Set<string>): CitationReport {
  // Only citations in the answer BODY count. A Sources list at the end that
  // names every result is not evidence that any claim is supported.
  const { body, sources: sourceList } = splitSources(text);

  // Check the model's own Sources list: does [n] point at the URL we gave it?
  const sourceListMismatches: CitationReport["sourceListMismatches"] = [];
  for (const line of sourceList.split("\n")) {
    const m = line.match(/\[(\d{1,3})\].*?(https?:\/\/[^\s)\]>]+)/);
    if (!m) continue;
    const index = Number(m[1]);
    const listedUrl = m[2]!.replace(/[.,;:!?]+$/, "");
    const actual = registry.get(index);
    if (!actual || normalizeUrl(actual.url) !== normalizeUrl(listedUrl))
      sourceListMismatches.push({ index, listedUrl, actualUrl: actual?.url ?? null });
  }

  const cited = new Set<number>();
  for (const m of body.matchAll(CITE_RE)) for (const n of citationNumbers(m[1]!)) cited.add(n);
  const sorted = [...cited].sort((a, b) => a - b);
  const valid = sorted.filter((n) => registry.get(n));
  const invalid = sorted.filter((n) => !registry.get(n));
  const readBacked = valid.filter((n) => registry.get(n)!.wasRead);
  const snippetOnly = valid.filter((n) => !registry.get(n)!.wasRead);

  const urls = (text.match(/https?:\/\/[^\s)\]>"'`]+/g) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ""));
  const unverifiedUrls = [...new Set(urls)].filter((u) => !seenUrls.has(normalizeUrl(u)));

  const claims = checkSupport(body, registry);
  const checked = claims.filter((c) => c.status !== "unchecked");
  const unsupported = [...new Set(claims.filter((c) => c.status === "unsupported").map((c) => c.index))].sort((a, b) => a - b);

  return {
    cited: sorted,
    valid,
    invalid,
    readBacked,
    snippetOnly,
    snippetOnlyCount: snippetOnly.length,
    unverifiedMarkers: (body.match(/\(unverified,\s*snippet only\)/gi) ?? []).length,
    unverifiedUrls,
    sourceListMismatches,
    precision: sorted.length ? round3(valid.length / sorted.length) : null,
    readRatio: valid.length ? round3(readBacked.length / valid.length) : null,
    claims,
    unsupported,
    supportRate: checked.length ? round3(checked.filter((c) => c.status === "supported").length / checked.length) : null,
  };
}

/** Human-readable warnings for everything the citation check flagged. */
export function citationWarnings(report: CitationReport, opts: { usedFallback: boolean; failed: boolean }): string[] {
  const out: string[] = [];
  const list = (ns: number[]) => ns.map((n) => `[${n}]`).join(", ");
  if (report.sourceListMismatches.length)
    out.push(
      `Model's Sources list mislabels ${list(report.sourceListMismatches.map((m) => m.index))} ` +
        `(URL differs from what was retrieved). Rebuilt the list from retrieved sources.`,
    );
  if (report.invalid.length) out.push(`Answer cites ${list(report.invalid)}, which were never retrieved (flagged).`);
  if (report.unverifiedUrls.length)
    out.push(`Answer mentions URLs that were never retrieved: ${report.unverifiedUrls.join(", ")}`);
  if (!opts.usedFallback && !opts.failed && report.cited.length === 0)
    out.push("Answer contains no inline [n] citations in its body; claims are unverified.");
  if (report.snippetOnlyCount > 0)
    out.push(
      `${report.snippetOnlyCount} cited source(s) ${list(report.snippetOnly)} are snippet-only (page never read with read_page). ` +
        `Claims that depend on them are unverified` +
        (report.unverifiedMarkers ? ` (the answer marks ${report.unverifiedMarkers} such claim(s)).` : ", and the answer does not mark them."),
    );
  const bad = report.claims.filter((c) => c.status === "unsupported");
  if (bad.length) {
    const example = bad[0]!;
    const missing = [...example.missingNumbers, ...example.missingTerms].slice(0, 4).join(", ");
    out.push(
      `${bad.length} cited claim(s) are not supported by their source ${list(report.unsupported)}: ` +
        `the numbers or names are not in that page (e.g. [${example.index}] is missing ${missing}). Support rate ${report.supportRate}.`,
    );
  }
  return out;
}
