import { route, ok } from "@/lib/api";
import { requireAdmin, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";
import { Prisma } from "@prisma/client";

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

export const GET = route(async (req) => {
  await requireAdmin(PERMISSIONS.CUSTOMERS_READ);

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const take = parseTake(url.searchParams.get("take"));
  const skip = parseSkip(url.searchParams.get("skip"));

  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { profile: { is: { firstName: { contains: q, mode: "insensitive" } } } },
      { profile: { is: { lastName: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        profile: { select: { firstName: true, lastName: true, phone: true, country: true } },
        riskScores: {
          where: { current: true },
          take: 1,
          select: { score: true, level: true, createdAt: true },
        },
      },
    }),
  ]);

  const data = users.map((u) => {
    const risk = u.riskScores.length > 0 ? u.riskScores[0] : undefined;
    return {
      id: u.id,
      email: u.email,
      status: u.status,
      kycStatus: u.kycStatus,
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
      profile: u.profile ?? null,
      riskScore: risk ? { score: risk.score, level: risk.level, createdAt: risk.createdAt } : null,
    };
  });

  return ok(serializeBigInt({ customers: data, total, take, skip }));
});
