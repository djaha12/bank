import { route, ok } from "@/lib/api";
import { requireAdmin, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/money";
import { AuditActorType, Prisma } from "@prisma/client";

const MAX_TAKE = 100;
const DEFAULT_TAKE = 50;

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

const ACTOR_VALUES = new Set<AuditActorType>(Object.values(AuditActorType));

export const GET = route(async (req) => {
  await requireAdmin(PERMISSIONS.AUDIT_READ);

  const url = new URL(req.url);
  const action = url.searchParams.get("action")?.trim();
  const entity = url.searchParams.get("entity")?.trim();
  const actorTypeRaw = url.searchParams.get("actorType");
  const take = parseTake(url.searchParams.get("take"));
  const skip = parseSkip(url.searchParams.get("skip"));

  const where: Prisma.AuditLogWhereInput = {};
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (entity) where.entity = entity;
  if (actorTypeRaw && ACTOR_VALUES.has(actorTypeRaw as AuditActorType)) {
    where.actorType = actorTypeRaw as AuditActorType;
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
  ]);

  return ok(serializeBigInt({ logs, total, take, skip }));
});
