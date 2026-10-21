import { NextRequest } from "next/server";
import { db } from "@/server/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Long page texts are trimmed; the trace UI shows previews and an expandable excerpt. */
const OBSERVATION_CHARS = 6000;

/**
 * GET /api/runs/:id — one NEXORA research run with its full trace:
 * Steps (by stepNo), Notes, Sources (by index) and the stored report
 * (citation report, sources with support flags, metrics, warnings, events).
 * `report` is null for runs saved before reportJson existed.
 */
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

  const { reportJson, ...rest } = run;
  return Response.json({
    run: {
      ...rest,
      report: safeJson(reportJson),
      startedAt: run.startedAt.getTime(),
      finishedAt: run.finishedAt?.getTime() ?? null,
      steps: run.steps.map((s) => {
        const args = safeJson(s.argsJson);
        return {
          ...s,
          args,
          auto: args?.auto === true,
          observation:
            s.observation.length > OBSERVATION_CHARS ? `${s.observation.slice(0, OBSERVATION_CHARS)}…` : s.observation,
          observationLength: s.observation.length,
          createdAt: s.createdAt.getTime(),
        };
      }),
      notes: run.notes.map((n) => ({ ...n, createdAt: n.createdAt.getTime() })),
      sources: run.sources.map((s) => ({ ...s, retrievedAt: s.retrievedAt.getTime() })),
    },
  });
}

function safeJson(s: string | null | undefined): Record<string, unknown> | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}
