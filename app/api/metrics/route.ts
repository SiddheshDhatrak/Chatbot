import { db } from "@/server/db";

export const runtime = "nodejs";

const round = (n: number | null | undefined, d = 3) =>
  n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d;

/**
 * GET /api/metrics — aggregate NEXORA stats over all finished runs
 * (runs still in progress are excluded).
 */
export async function GET() {
  const where = { status: { not: "running" } };
  const [agg, byStatus, fallbacks, cancelled, precision] = await Promise.all([
    db.run.aggregate({
      where,
      _count: { _all: true },
      _avg: { totalLatencyMs: true, totalSteps: true, totalToolCalls: true, totalTokens: true },
    }),
    db.run.groupBy({ by: ["status"], where, _count: { _all: true } }),
    db.run.count({ where: { ...where, usedFallback: true } }),
    db.run.count({ where: { ...where, cancelled: true } }),
    db.run.aggregate({ where: { ...where, citationPrecision: { not: null } }, _avg: { citationPrecision: true } }),
  ]);

  const runs = agg._count._all;
  const count = (status: string) => byStatus.find((s) => s.status === status)?._count._all ?? 0;
  const rate = (n: number) => (runs ? round(n / runs) : null);

  return Response.json({
    runs,
    avgLatencyMs: round(agg._avg.totalLatencyMs, 0),
    avgSteps: round(agg._avg.totalSteps, 2),
    avgToolCalls: round(agg._avg.totalToolCalls, 2),
    avgTokens: round(agg._avg.totalTokens, 0),
    completionRate: rate(count("completed")),
    stepLimitRate: rate(count("step_limit")),
    errorRate: rate(count("error")),
    cancelledRate: rate(cancelled),
    avgCitationPrecision: round(precision._avg.citationPrecision),
    fallbackRate: rate(fallbacks),
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
  });
}
