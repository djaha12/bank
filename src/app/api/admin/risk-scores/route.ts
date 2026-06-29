import { route, ok } from "@/lib/api";
import { requireAdmin, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";
import { Prisma, RiskLevel } from "@prisma/client";

const MAX_TAKE = 100;
const DEFAULT_TAKE = 25;

function parseTake(raw: string | null): number {
  if (!raw) return DEFAULT_TAKE;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TAKE;
  return Math.min(n, MAX_TAKE);
}

function parseSkip(raw: string | null): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

const LEVEL_VALUES = new Set<RiskLevel>(Object.values(RiskLevel));

export const GET = route(async (req) => {
  await requireAdmin(PERMISSIONS.RISK_READ);

  const url = new URL(req.url);
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
  const levelRaw = url.searchParams.get("level");
  const take = parseTake(url.searchParams.get("take"));
  const skip = parseSkip(url.searchParams.get("skip"));

  const where: Prisma.RiskScoreWhereInput = { current: true };
  if (levelRaw && LEVEL_VALUES.has(levelRaw as RiskLevel)) {
    where.level = levelRaw as RiskLevel;
  }

  const [total, scores] = await Promise.all([
    prisma.riskScore.count({ where }),
    prisma.riskScore.findMany({
      where,
      orderBy: { score: order },
      take,
      skip,
      include: { user: { select: { id: true, email: true, kycStatus: true, status: true } } },
    }),
  ]);

  const data = scores.map((s) => ({
    id: s.id,
    userId: s.userId,
    userEmail: s.user?.email ?? null,
    kycStatus: s.user?.kycStatus ?? null,
    userStatus: s.user?.status ?? null,
    score: s.score,
    level: s.level,
    factors: s.factors,
    createdAt: s.createdAt,
  }));

  return ok(serializeBigInt({ riskScores: data, total, take, skip }));
});
