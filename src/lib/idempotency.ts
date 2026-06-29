import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Stable JSON stringify (sorted keys) for hashing request bodies. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

export function hashRequest(body: unknown): string {
  return createHash("sha256").update(canonicalJson(body)).digest("hex");
}

export interface IdemHandlerResult {
  status: number;
  body: unknown;
  transactionId?: string;
}

export type IdemOutcome =
  | { kind: "ok"; status: number; body: unknown; replayed: boolean }
  | { kind: "conflict"; status: number; body: unknown };

const TTL_HOURS = 24;

/**
 * Idempotency guard for money-movement endpoints. Guarantees that retrying a
 * request with the same `key` never double-posts:
 *  - first call runs `handler` and stores its response;
 *  - a retry with the SAME body replays the stored response;
 *  - a retry with a DIFFERENT body is rejected (422);
 *  - a concurrent in-flight retry is rejected (409).
 *
 * The handler is expected to be internally atomic (use prisma.$transaction).
 */
export async function withIdempotency(
  opts: { key: string; userId: string | null; endpoint: string; body: unknown },
  handler: () => Promise<IdemHandlerResult>,
): Promise<IdemOutcome> {
  const requestHash = hashRequest(opts.body);
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000);

  let created = false;
  try {
    await prisma.idempotencyKey.create({
      data: {
        key: opts.key,
        userId: opts.userId,
        endpoint: opts.endpoint,
        requestHash,
        status: "IN_PROGRESS",
        expiresAt,
      },
    });
    created = true;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
      throw err;
    }
  }

  if (!created) {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key_endpoint: { key: opts.key, endpoint: opts.endpoint } },
    });
    if (!existing) {
      // Extremely rare race: the row vanished between create and read.
      return { kind: "conflict", status: 409, body: { error: "Idempotency conflict, retry" } };
    }
    if (existing.requestHash !== requestHash) {
      return {
        kind: "conflict",
        status: 422,
        body: { error: "Idempotency-Key reused with a different request body" },
      };
    }
    if (existing.status === "COMPLETED") {
      return {
        kind: "ok",
        status: existing.responseCode ?? 200,
        body: existing.responseBody,
        replayed: true,
      };
    }
    return {
      kind: "conflict",
      status: 409,
      body: { error: "A request with this Idempotency-Key is still in progress" },
    };
  }

  try {
    const result = await handler();
    await prisma.idempotencyKey.update({
      where: { key_endpoint: { key: opts.key, endpoint: opts.endpoint } },
      data: {
        status: "COMPLETED",
        responseCode: result.status,
        responseBody: (result.body ?? null) as Prisma.InputJsonValue,
        transactionId: result.transactionId,
      },
    });
    return { kind: "ok", status: result.status, body: result.body, replayed: false };
  } catch (err) {
    // Handler failed before completing — drop the key so the client may retry.
    await prisma.idempotencyKey
      .delete({ where: { key_endpoint: { key: opts.key, endpoint: opts.endpoint } } })
      .catch(() => undefined);
    throw err;
  }
}
