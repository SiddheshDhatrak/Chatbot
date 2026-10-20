import { type ToolResult, ok, fail, errMsg } from "./types";

export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
}

const TAVILY_URL = "https://api.tavily.com/search";
const TIMEOUT_MS = 10_000;

/** web_search(query, k): top-k results from Tavily as {url, title, snippet}. */
export async function webSearch(query: string, k = 5): Promise<ToolResult<SearchHit[]>> {
  const q = (query ?? "").trim();
  if (!q) return fail("Query is empty");
  const key = process.env.TAVILY_API_KEY;
  if (!key) return fail("TAVILY_API_KEY is not set");
  const maxResults = Math.min(Math.max(Math.floor(k) || 5, 1), 10);

  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query: q.slice(0, 400), max_results: maxResults, search_depth: "basic" }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return fail(`Tavily ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      results?: { url?: string; title?: string; content?: string }[];
    };
    const hits: SearchHit[] = (json.results ?? [])
      .filter((r) => typeof r.url === "string" && /^https?:\/\//i.test(r.url))
      .slice(0, maxResults)
      .map((r) => ({
        url: r.url!,
        title: (r.title ?? "").replace(/<!--[\s\S]*?-->|<[^>]+>/g, "").trim() || r.url!,
        snippet: (r.content ?? "").replace(/\s+/g, " ").trim().slice(0, 500),
      }));
    return ok(hits);
  } catch (err) {
    return fail(`web_search failed: ${errMsg(err)}`);
  }
}
