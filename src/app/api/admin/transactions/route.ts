import { route, ok } from "@/lib/api";
import { requireAdmin, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";
import { Prisma, TransactionStatus, TransactionType } from "@prisma/client";

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

const STATUS_VALUES = new Set<TransactionStatus>(Object.values(TransactionStatus));
const TYPE_VALUES = new Set<TransactionType>(Object.values(TransactionType));

export const GET = route(async (req) => {
  await requireAdmin(PERMISSIONS.TRANSACTIONS_READ);

  const url = new URL(req.url);
  const statusRaw = url.searchParams.get("status");
  const typeRaw = url.searchParams.get("type");
  const userId = url.searchParams.get("userId");
  const q = url.searchParams.get("q")?.trim();
  const take = parseTake(url.searchParams.get("take"));
  const skip = parseSkip(url.searchParams.get("skip"));

  const where: Prisma.TransactionWhereInput = {};
  if (statusRaw && STATUS_VALUES.has(statusRaw as TransactionStatus)) {
    where.status = statusRaw as TransactionStatus;
  }
  if (typeRaw && TYPE_VALUES.has(typeRaw as TransactionType)) {
    where.type = typeRaw as TransactionType;
  }
  if (userId) where.userId = userId;
  if (q) {
    where.OR = [
      { reference: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { user: { is: { email: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [total, txns] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { user: { select: { id: true, email: true } } },
    }),
  ]);

  const data = txns.map((t) => ({
    id: t.id,
    type: t.type,
    status: t.status,
    currency: t.currency,
    amount: t.amount,
    feeAmount: t.feeAmount,
    description: t.description,
    reference: t.reference,
    userId: t.userId,
    userEmail: t.user?.email ?? null,
    createdAt: t.createdAt,
    postedAt: t.postedAt,
  }));

  return ok(serializeBigInt({ transactions: data, total, take, skip }));
});
