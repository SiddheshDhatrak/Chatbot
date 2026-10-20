import { db } from "@/server/db";
import { type ToolResult, ok, fail, errMsg } from "./types";

export interface SavedNote {
  id: string;
  title: string;
  content: string;
  sourceUrl: string | null;
}
export interface ScoredNote extends SavedNote {
  score: number;
}

/** save_note: persist a finding for this run to SQLite. */
export async function saveNote(
  runId: string,
  title: string,
  content: string,
  sourceUrl?: string,
): Promise<ToolResult<SavedNote>> {
  const t = (title ?? "").trim().slice(0, 200);
  const c = (content ?? "").trim().slice(0, 4000);
  if (!runId) return fail("Missing runId");
  if (!t || !c) return fail("Note needs a title and content");
  try {
    const note = await db.note.create({
      data: { runId, title: t, content: c, sourceUrl: sourceUrl?.trim() || null },
      select: { id: true, title: true, content: true, sourceUrl: true },
    });
    return ok(note);
  } catch (err) {
    return fail(`save_note failed: ${errMsg(err)}`);
  }
}

// ---------- keyword / TF-IDF retrieval ("semantic memory" v0) ----------

const STOP = new Set(
  "a an the and or of to in on for with by is are was were be been it this that as at from what which who how why when where do does did not no".split(
    " ",
  ),
);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w));
}

/** Top-5 notes of a run ranked by TF-IDF against the query. */
export async function searchNotes(runId: string, query: string): Promise<ToolResult<ScoredNote[]>> {
  try {
    const notes = await db.note.findMany({
      where: { runId },
      select: { id: true, title: true, content: true, sourceUrl: true },
    });
    const qTerms = [...new Set(tokenize(query ?? ""))];
    if (notes.length === 0 || qTerms.length === 0) return ok([]);

    const docs = notes.map((n) => {
      const toks = tokenize(`${n.title} ${n.title} ${n.content}`); // title counts double
      const tf = new Map<string, number>();
      for (const w of toks) tf.set(w, (tf.get(w) ?? 0) + 1);
      return { n, tf, len: toks.length || 1 };
    });
    const N = docs.length;
    const idf = (w: string) => {
      const df = docs.filter((d) => d.tf.has(w)).length;
      return Math.log((N + 1) / (df + 1)) + 1;
    };
    const scored = docs
      .map(({ n, tf, len }) => ({
        ...n,
        score: qTerms.reduce((s, w) => s + ((tf.get(w) ?? 0) / len) * idf(w), 0),
      }))
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((d) => ({ ...d, score: Math.round(d.score * 1000) / 1000 }));
    return ok(scored);
  } catch (err) {
    return fail(`search_notes failed: ${errMsg(err)}`);
  }
}
