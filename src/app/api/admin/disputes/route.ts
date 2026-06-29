import { route, ok } from "@/lib/api";
import { requireAdmin, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";
import { DisputeStatus, Prisma } from "@prisma/client";

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

const STATUS_VALUES = new Set<DisputeStatus>(Object.values(DisputeStatus));

export const GET = route(async (req) => {
  await requireAdmin(PERMISSIONS.DISPUTES_READ);

  const url = new URL(req.url);
  const statusRaw = url.searchParams.get("status");
  const take = parseTake(url.searchParams.get("take"));
  const skip = parseSkip(url.searchParams.get("skip"));

  const where: Prisma.DisputeWhereInput = {};
  if (statusRaw && STATUS_VALUES.has(statusRaw as DisputeStatus)) {
    where.status = statusRaw as DisputeStatus;
  }

  const [total, disputes] = await Promise.all([
    prisma.dispute.count({ where }),
    prisma.dispute.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        user: { select: { id: true, email: true } },
        transaction: { select: { id: true, type: true, status: true, reference: true } },
      },
    }),
  ]);

  const data = disputes.map((d) => ({
    id: d.id,
    userId: d.userId,
    userEmail: d.user?.email ?? null,
    transactionId: d.transactionId,
    transaction: d.transaction,
    reason: d.reason,
    status: d.status,
    amount: d.amount,
    currency: d.currency,
    resolution: d.resolution,
    handledBy: d.handledBy,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));

  return ok(serializeBigInt({ disputes: data, total, take, skip }));
});
