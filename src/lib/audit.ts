import { createHash } from "node:crypto";
import { AuditActorType, Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { canonicalJson } from "@/lib/idempotency";
import { serializeBigInt } from "@/lib/money";

export interface AuditInput {
  actorType: AuditActorType;
  actorId?: string | null;
  action: string; // e.g. "transfer.create", "kyc.approve", "admin.account.block"
  entity: string; // e.g. "Transaction"
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Append a tamper-evident audit log entry. Each row stores
 *   hash = sha256(prevHash + canonical(payload))
 * forming a hash chain. Any retro-edit of an earlier row breaks every later
 * hash, which the integrity verifier (verifyAuditChain) detects.
 *
 * NOTE: under high concurrency the global chain can fork (two writers read the
 * same prevHash). For the sandbox this is acceptable; production should use a
 * monotonic sequence + WORM storage (see SECURITY.md).
 */
export async function writeAudit(input: AuditInput, client: Tx | typeof prisma = prisma) {
  const last = await client.auditLog.findFirst({
    orderBy: { createdAt: "desc" },
    select: { hash: true },
  });
  const prevHash = last?.hash ?? null;

  const payload = serializeBigInt({
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? null,
  });

  const hash = createHash("sha256")
    .update((prevHash ?? "") + canonicalJson(payload))
    .digest("hex");

  return client.auditLog.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId ?? undefined,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? undefined,
      before: (payload.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      after: (payload.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      metadata: (payload.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
      prevHash,
      hash,
    },
  });
}

/** Verify the audit hash chain. Returns the first broken row id, or null. */
export async function verifyAuditChain(): Promise<{ ok: boolean; brokenAt: string | null }> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      hash: true,
      prevHash: true,
      actorType: true,
      actorId: true,
      action: true,
      entity: true,
      entityId: true,
      before: true,
      after: true,
      metadata: true,
    },
  });
  let prev: string | null = null;
  for (const row of rows) {
    const payload = {
      actorType: row.actorType,
      actorId: row.actorId ?? null,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId ?? null,
      before: row.before ?? null,
      after: row.after ?? null,
      metadata: row.metadata ?? null,
    };
    const expected: string = createHash("sha256")
      .update((prev ?? "") + canonicalJson(payload))
      .digest("hex");
    if (row.prevHash !== prev || row.hash !== expected) {
      return { ok: false, brokenAt: row.id };
    }
    prev = row.hash;
  }
  return { ok: true, brokenAt: null };
}
