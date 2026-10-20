/**
 * NEXORA citation checking.
 *
 * Citation rule: every claim cites [n], and [n] must map to a URL the agent
 * actually retrieved in this run. The harness checks this AFTER the model
 * writes its answer, and flags anything that doesn't hold.
 */
import { normalizeUrl } from "./tools";

export interface SourceRef {
  index: number;
  url: string;
  title: string;
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
  /** valid / cited. null when the answer has no citations. Measures provenance, not truth. */
  precision: number | null;
}

type Registry = { get(i: number): { url: string; wasRead: boolean } | undefined };

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

/**
 * Replace the model's Sources section with one built by the harness from the
 * registry, so every [n] is listed with the URL that was really retrieved.
 */
export function withHarnessSources(text: string, sources: (SourceRef & { wasRead?: boolean })[]): string {
  const body = splitSources(text).body.replace(/\s*(?:-{3,}|\*{3,})\s*$/, "").trimEnd();
  if (!sources.length) return body;
  const list = sources
    .map((s) => `[${s.index}] ${s.title} - ${s.url}${s.wasRead === false ? " (snippet only)" : ""}`)
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
  // Matches [1], [1, 2], [1][3], [2-4]
  for (const m of body.matchAll(/\[(\d{1,3}(?:\s*[,–-]\s*\d{1,3})*)\]/g)) {
    for (const part of m[1]!.split(",")) {
      const range = part.split(/[–-]/).map((x) => Number(x.trim()));
      if (range.length === 2 && range[1]! >= range[0]! && range[1]! - range[0]! <= 20) {
        for (let n = range[0]!; n <= range[1]!; n++) cited.add(n);
      } else if (Number.isFinite(range[0])) cited.add(range[0]!);
    }
  }
  const sorted = [...cited].sort((a, b) => a - b);
  const valid = sorted.filter((n) => registry.get(n));
  const invalid = sorted.filter((n) => !registry.get(n));
  const readBacked = valid.filter((n) => registry.get(n)!.wasRead);
  const snippetOnly = valid.filter((n) => !registry.get(n)!.wasRead);

  const urls = (text.match(/https?:\/\/[^\s)\]>"'`]+/g) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ""));
  const unverifiedUrls = [...new Set(urls)].filter((u) => !seenUrls.has(normalizeUrl(u)));

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
    precision: sorted.length ? Math.round((valid.length / sorted.length) * 1000) / 1000 : null,
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
  return out;
}
