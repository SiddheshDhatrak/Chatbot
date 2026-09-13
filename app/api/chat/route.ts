import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { streamReply, SYSTEM_PROMPT, type ChatMsg } from "@/server/ai";
import { sanitizeModel } from "@/lib/models";

export const runtime = "nodejs";

function titleFrom(text: string) {
  const t = text.replace(/[#*`>\n]/g, " ").trim().slice(0, 42);
  return t.length < text.trim().length ? `${t}…` : t || "New conversation";
}

function sse(data: string) {
  return `data: ${data}\n\n`;
}

/**
 * POST /api/chat  { sessionId?, message }
 * Streams SSE events:
 *   data: {"sessionId":"..."}
 *   data: {"delta":"..."}   (repeated)
 *   data: [DONE]            (success)
 *   data: {"error":"..."}   (failure, also persisted as assistant message)
 */
export async function POST(req: NextRequest) {
  let body: { sessionId?: string; message?: string; regenerate?: boolean; model?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) return Response.json({ error: "Empty message" }, { status: 400 });
  if (message.length > 24000)
    return Response.json({ error: "Message too long (max 24000 chars)" }, { status: 413 });
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
      const push = (s: string) => controller.enqueue(enc.encode(s));
      push(sse(JSON.stringify({ sessionId })));
      try {
        for await (const delta of streamReply(chat, { signal: clientGone, model })) {
          if (clientGone.aborted) break;
          full += delta;
          push(sse(JSON.stringify({ delta })));
        }
      } catch (err) {
        streamError =
          err instanceof Error ? err.message : "AI provider failed";
        console.error("[api/chat]", streamError);
        push(sse(JSON.stringify({ error: streamError })));
      } finally {
        try {
          if (full.trim()) {
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
        controller.close();
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
