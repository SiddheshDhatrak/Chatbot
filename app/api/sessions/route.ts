import { db } from "@/server/db";

export const runtime = "nodejs";

/** GET /api/sessions — conversation list for the sidebar (newest first). */
export async function GET() {
  const sessions = await db.session.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      createdAt: true,
      _count: { select: { messages: true, runs: true } },
    },
  });
  return Response.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: new Date(s.updatedAt).getTime(),
      createdAt: new Date(s.createdAt).getTime(),
      messageCount: s._count.messages,
      hasResearch: s._count.runs > 0, // NEXORA: show a research badge
    })),
  });
}
