import { NextRequest } from "next/server";
import { db } from "@/server/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/runs/:id — one NEXORA research run with its full trace. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const run = await db.run.findUnique({
    where: { id },
    include: {
      steps: { orderBy: [{ stepNo: "asc" }, { createdAt: "asc" }] },
      notes: { orderBy: { createdAt: "asc" } },
      sources: { orderBy: { index: "asc" } },
    },
  });
  if (!run) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({
    run: {
      ...run,
      startedAt: run.startedAt.getTime(),
      finishedAt: run.finishedAt?.getTime() ?? null,
      steps: run.steps.map((s) => ({
        ...s,
        args: safeJson(s.argsJson),
        auto: safeJson(s.argsJson)?.auto === true,
        createdAt: s.createdAt.getTime(),
      })),
      notes: run.notes.map((n) => ({ ...n, createdAt: n.createdAt.getTime() })),
      sources: run.sources.map((s) => ({ ...s, retrievedAt: s.retrievedAt.getTime() })),
    },
  });
}

function safeJson(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}
