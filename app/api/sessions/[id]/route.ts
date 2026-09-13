import { NextRequest } from "next/server";
import { db } from "@/server/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/sessions/:id — full message history for one conversation. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = await db.session.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({
    session: {
      id: session.id,
      title: session.title,
      updatedAt: new Date(session.updatedAt).getTime(),
      createdAt: new Date(session.createdAt).getTime(),
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.content,
        createdAt: new Date(m.createdAt).getTime(),
      })),
    },
  });
}

/** PATCH /api/sessions/:id  { title } — rename a conversation. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const title = (body.title ?? "").trim().slice(0, 80);
  if (!title) return Response.json({ error: "Empty title" }, { status: 400 });
  try {
    const session = await db.session.update({
      where: { id },
      data: { title },
    });
    return Response.json({ id: session.id, title: session.title });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

/** DELETE /api/sessions/:id — delete a conversation and its messages. */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await db.session.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}
