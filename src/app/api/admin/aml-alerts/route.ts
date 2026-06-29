import { route, ok } from "@/lib/api";
import { requireAdmin, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";
import { AlertStatus, Prisma, RiskLevel } from "@prisma/client";

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

const STATUS_VALUES = new Set<AlertStatus>(Object.values(AlertStatus));
const LEVEL_VALUES = new Set<RiskLevel>(Object.values(RiskLevel));

export const GET = route(async (req) => {
  await requireAdmin(PERMISSIONS.AML_READ);

  const url = new URL(req.url);
  const statusRaw = url.searchParams.get("status");
  const levelRaw = url.searchParams.get("level");
  const take = parseTake(url.searchParams.get("take"));
  const skip = parseSkip(url.searchParams.get("skip"));

  const where: Prisma.AmlAlertWhereInput = {};
  if (statusRaw && STATUS_VALUES.has(statusRaw as AlertStatus)) {
    where.status = statusRaw as AlertStatus;
  }
  if (levelRaw && LEVEL_VALUES.has(levelRaw as RiskLevel)) {
    where.level = levelRaw as RiskLevel;
  }

  const [total, alerts] = await Promise.all([
    prisma.amlAlert.count({ where }),
    prisma.amlAlert.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { user: { select: { id: true, email: true } } },
    }),
  ]);

  const data = alerts.map((a) => ({
    id: a.id,
    userId: a.userId,
    userEmail: a.user?.email ?? null,
    transactionId: a.transactionId,
    ruleCode: a.ruleCode,
    level: a.level,
    status: a.status,
    reason: a.reason,
    details: a.details,
    assignedTo: a.assignedTo,
    adminNotes: a.adminNotes,
    resolvedAt: a.resolvedAt,
    createdAt: a.createdAt,
  }));

  return ok(serializeBigInt({ alerts: data, total, take, skip }));
});
