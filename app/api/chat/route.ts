import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { streamReply, SYSTEM_PROMPT, type ChatMsg } from "@/server/ai";
import { sanitizeModel } from "@/lib/models";
import { runAgent, splitSources, STOPPED_MESSAGE } from "@/server/agent";
import { withStoppedMarker } from "@/lib/chatMarkers";

export const runtime = "nodejs";
// Research runs can take minutes (Groq free-tier rate-limit pauses of 30-50s).
export const maxDuration = 300;

function titleFrom(text: string) {
  const t = text.replace(/[#*`>\n]/g, " ").trim().slice(0, 42);
  return t.length < text.trim().length ? `${t}…` : t || "New conversation";
}

function sse(data: string) {
  return `data: ${data}\n\n`;
}

/**
 * POST /api/chat  { sessionId?, message, mode?: "chat" | "research" }
 * Streams SSE events:
 *   data: {"sessionId":"..."}
 *   data: {"delta":"..."}   (repeated)
 *   data: [DONE]            (success)
 *   data: {"error":"..."}   (failure, also persisted as assistant message)
 * Research mode adds  data: {"agent": {...event}}  frames (old clients ignore
 * them) and ": keep-alive" comment lines; the answer still arrives as deltas.
 */
export async function POST(req: NextRequest) {
  let body: { sessionId?: string; message?: string; regenerate?: boolean; model?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) return Response.json({ error: "Empty message" }, { status: 400 });
  if (message.length > 24000)
    return Response.json({ error: "Message too long (max 24000 chars)" }, { status: 413 });
  if (body.mode === "research") return researchResponse(req, body, message);
  const model = sanitizeModel(body.model) ?? undefined;

  // Resolve or create the session, then persist the user message.
  let session = body.sessionId
    ? await db.session.findUnique({ where: { id: body.sessionId } })
    : null;
  if (!session) {
    session = await db.session.create({ data: { title: titleFrom(message) } });
  }
  const sessionId = session.id;
  const isFirstUserMsg =
    (await db.message.count({ where: { sessionId, role: "user" } })) === 0;

  // Regenerate re-streams the existing history without duplicating the user row.
  if (!body.regenerate) {
    await db.message.create({ data: { sessionId, role: "user", content: message } });
  }
  if (isFirstUserMsg && session.title === "New conversation") {
    await db.session.update({
      where: { id: sessionId },
      data: { title: titleFrom(message) },
    });
  }

  const history = await db.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  const chat: ChatMsg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const clientGone = req.signal;
  let full = "";
  let streamError: string | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const push = (s: string) => {
        if (clientGone.aborted) return; // client gone: nothing to write to
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          /* stream already closed */
        }
      };
      push(sse(JSON.stringify({ sessionId })));
      try {
        // clientGone is passed to the upstream fetch (Groq / Pollinations), so a
        // disconnect or Stop cancels generation there too.
        for await (const delta of streamReply(chat, { signal: clientGone, model })) {
          if (clientGone.aborted) break;
          full += delta;
          push(sse(JSON.stringify({ delta })));
        }
      } catch (err) {
        if (!clientGone.aborted) {
          streamError = err instanceof Error ? err.message : "AI provider failed";
          console.error("[api/chat]", streamError);
          push(sse(JSON.stringify({ error: streamError })));
        }
        // Aborted by the client: not an error; the partial answer is saved below.
      } finally {
        try {
          if (clientGone.aborted) {
            // Stopped: save only what was streamed so far, clearly marked.
            await db.message.create({
              data: { sessionId, role: "assistant", content: withStoppedMarker(full) },
            });
          } else if (full.trim()) {
            await db.message.create({
              data: { sessionId, role: "assistant", content: full },
            });
          } else if (streamError) {
            await db.message.create({
              data: {
                sessionId,
                role: "assistant",
                content: `⚠️ I couldn't generate a reply (${streamError}). Please try again.`,
              },
            });
          }
          await db.session.update({
            where: { id: sessionId },
            data: { updatedAt: new Date() },
          });
        } catch (dbErr) {
          console.error("[api/chat] persist failed:", dbErr);
        }
        if (!clientGone.aborted) push(sse("[DONE]"));
        try {
          controller.close();
        } catch {
          /* already closed by the disconnect */
        }
      }
    },
    cancel() {
      /* client disconnected — partial reply (if any) is still persisted above */
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// ===========================================================================
//  Research mode (NEXORA agent)
// ===========================================================================

const KEEP_ALIVE_MS = 15_000;
const HISTORY_MESSAGES = 6;
const HISTORY_ASSISTANT_CHARS = 800;

/** Research accepts the curated Groq models, or an explicit "openrouter:..." id. */
function researchModel(input: unknown): string | undefined {
  if (typeof input === "string" && /^openrouter:[\w.\-/:]{3,120}$/.test(input.trim())) return input.trim();
  return sanitizeModel(input) ?? undefined;
}

/**
 * Follow-up context for the agent: last few messages, text only. Old answers
 * lose their Sources list and [n] markers, because citation numbers restart
 * in every run and must not be confused with the new run's sources.
 */
function toHistory(rows: { role: string; content: string }[]) {
  return rows.map((m) => {
    if (m.role !== "assistant") return { role: "user" as const, content: m.content };
    const body = splitSources(m.content).body.replace(/\s*\[\d{1,3}\]/g, "").trim();
    const short = body.length > HISTORY_ASSISTANT_CHARS ? `${body.slice(0, HISTORY_ASSISTANT_CHARS)}…` : body;
    return { role: "assistant" as const, content: short };
  });
}

async function researchResponse(
  req: NextRequest,
  body: { sessionId?: string; regenerate?: boolean; model?: string },
  question: string,
) {
  const model = researchModel(body.model);

  // Session + history (loaded BEFORE saving the new question, so the agent
  // gets the question once, as its own user turn).
  let session = body.sessionId ? await db.session.findUnique({ where: { id: body.sessionId } }) : null;
  if (!session) session = await db.session.create({ data: { title: titleFrom(question) } });
  const sessionId = session.id;

  const recent = await db.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_MESSAGES + 1,
    select: { role: true, content: true },
  });
  recent.reverse();
  // On regenerate the question is already the last stored user message.
  if (body.regenerate && recent.at(-1)?.role === "user") recent.pop();
  const history = toHistory(recent.slice(-HISTORY_MESSAGES));

  if (!body.regenerate) {
    await db.message.create({ data: { sessionId, role: "user", content: question } });
  }
  if (session.title === "New conversation") {
    await db.session.update({ where: { id: sessionId }, data: { title: titleFrom(question) } });
  }

  const clientGone = req.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      const push = (s: string) => {
        if (closed || clientGone.aborted) return;
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          closed = true; // client already gone
        }
      };
      // SSE comment lines keep the Vite proxy and the browser from timing
      // out during long rate-limit pauses. Old parsers ignore them.
      const keepAlive = setInterval(() => push(": keep-alive\n\n"), KEEP_ALIVE_MS);

      push(sse(JSON.stringify({ sessionId })));

      let runId: string | null = null;
      let answer = "";
      let failure: string | null = null;
      try {
        // Always drain the generator, even after a disconnect: the agent sees
        // the aborted signal, stops before its next LLM or tool call, and
        // still saves the Run (cancelled) with the steps done so far.
        for await (const ev of runAgent({ question, sessionId, model, history, signal: clientGone })) {
          if (ev.type === "run_start") runId = ev.runId;
          if (ev.type === "warning" && !runId) failure = ev.message; // could not start
          push(sse(JSON.stringify({ agent: ev })));
          if (ev.type === "answer") {
            answer = ev.text;
            // Existing clients render deltas, so send the answer that way too.
            for (let i = 0; i < answer.length; i += 400) push(sse(JSON.stringify({ delta: answer.slice(i, i + 400) })));
          }
        }
      } catch (err) {
        failure = err instanceof Error ? err.message : "Research agent failed";
        console.error("[api/chat research]", failure);
      } finally {
        clearInterval(keepAlive);
        if (!answer && failure) push(sse(JSON.stringify({ error: failure })));
        try {
          const content =
            answer ||
            (clientGone.aborted
              ? STOPPED_MESSAGE
              : `⚠️ Research failed (${failure ?? "no answer"}). Please try again.`);
          await db.message.create({ data: { sessionId, role: "assistant", content, runId } });
          await db.session.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
        } catch (dbErr) {
          console.error("[api/chat research] persist failed:", dbErr);
        }
        push(sse("[DONE]"));
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
