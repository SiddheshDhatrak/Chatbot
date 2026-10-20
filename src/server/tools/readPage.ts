import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { type ToolResult, ok, fail, errMsg } from "./types";

export interface PageContent {
  url: string; // final URL after redirects
  title: string;
  author?: string;
  publishedDate?: string;
  text: string;
  truncated: boolean;
}

const TIMEOUT_MS = 10_000;
const MAX_TEXT = 6000;
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 5;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// ---------- SSRF guard ----------

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast + reserved
  );
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateV4(ip);
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]!);
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("::ffff:") || // hex-form IPv4-mapped: block to be safe
    v6.startsWith("fc") ||
    v6.startsWith("fd") || // unique local
    /^fe[89ab]/.test(v6) || // link-local
    v6.startsWith("ff") // multicast
  );
}

/** Returns an error string if the URL is not safe to fetch, else null. */
export async function checkUrlSafe(raw: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "Invalid URL";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "Only http/https URLs are allowed";
  if (u.username || u.password) return "URLs with credentials are not allowed";
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  )
    return "Blocked host (local network)";
  if (isIP(host)) return isPrivateIp(host) ? "Blocked host (private IP)" : null;
  try {
    const addrs = await lookup(host, { all: true });
    if (addrs.length === 0) return "Host did not resolve";
    if (addrs.some((a) => isPrivateIp(a.address))) return "Blocked host (resolves to private IP)";
  } catch {
    return "Host did not resolve";
  }
  return null;
}

// ---------- fetch + extract ----------

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(value);
    if (total >= MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function meta(doc: Document, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const v = doc.querySelector(sel)?.getAttribute("content")?.trim();
    if (v) return v;
  }
  return undefined;
}

/** read_page(url): readable text + title/author/date metadata. Never throws. */
export async function readPage(url: string): Promise<ToolResult<PageContent>> {
  try {
    let current = (url ?? "").trim();
    let res: Response | null = null;
    const signal = AbortSignal.timeout(TIMEOUT_MS);

    // Follow redirects manually so every hop passes the SSRF check.
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const unsafe = await checkUrlSafe(current);
      if (unsafe) return fail(`${unsafe}: ${current}`);
      res = await fetch(current, {
        redirect: "manual",
        signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current).toString();
        await res.body?.cancel().catch(() => {});
        res = null;
        continue;
      }
      break;
    }
    if (!res) return fail("Too many redirects");
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return fail(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""} for ${current}`);
    }
    const type = res.headers.get("content-type") ?? "";
    if (type && !/text\/html|application\/xhtml\+xml/i.test(type)) {
      await res.body?.cancel().catch(() => {});
      return fail(`Not an HTML page (content-type: ${type.split(";")[0]})`);
    }

    const html = await readCapped(res);
    // Scripts are NOT executed (jsdom default). VirtualConsole swallows CSS/parse noise.
    const dom = new JSDOM(html, { url: current, virtualConsole: new VirtualConsole() });
    const doc = dom.window.document;

    const article = new Readability(doc.cloneNode(true) as Document).parse();
    const rawText = article?.textContent || doc.body?.textContent || "";
    const text = rawText
      .replace(/[ \t ]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim();

    const title =
      article?.title?.trim() || doc.title?.trim() || meta(doc, ['meta[property="og:title"]']) || current;
    const author =
      article?.byline?.trim() ||
      meta(doc, ['meta[name="author"]', 'meta[property="article:author"]']) ||
      undefined;
    const publishedDate =
      article?.publishedTime?.trim() ||
      meta(doc, [
        'meta[property="article:published_time"]',
        'meta[name="date"]',
        'meta[name="publish-date"]',
        'meta[itemprop="datePublished"]',
      ]) ||
      undefined;
    dom.window.close();

    if (text.length < 50) return fail("Page has no readable text (possibly JS-rendered or blocked)");
    const truncated = text.length > MAX_TEXT;
    return ok({
      url: current,
      title,
      author,
      publishedDate,
      text: truncated ? `${text.slice(0, MAX_TEXT)}\n…[truncated]` : text,
      truncated,
    });
  } catch (err) {
    return fail(`read_page failed: ${errMsg(err)}`);
  }
}
