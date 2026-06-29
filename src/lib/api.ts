import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { AppError, Errors } from "@/lib/errors";
import { serializeBigInt } from "@/lib/money";
import { rateLimit, sweepRateLimiter, type RateLimitResult } from "@/lib/ratelimit";

/** Successful JSON response with BigInt-safe serialization. */
export function ok(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(serializeBigInt({ data }), { status, headers });
}

/** Map any thrown value to a safe JSON error (never leaks stack traces). */
export function fail(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details ?? null } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details: err.flatten(),
        },
      },
      { status: 422 },
    );
  }
  // Unknown/unexpected — log server-side, return generic message.
  // eslint-disable-next-line no-console
  console.error("[api] unhandled error:", err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong" } },
    { status: 500 },
  );
}

export interface ClientContext {
  ip: string | null;
  userAgent: string | null;
}

export function getClientContext(req: NextRequest): ClientContext {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? (fwd.split(",")[0]?.trim() ?? null) : req.headers.get("x-real-ip");
  return { ip, userAgent: req.headers.get("user-agent") };
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw Errors.validation("Request body must be valid JSON");
  }
}

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  const body = await readJson(req);
  return schema.parse(body);
}

export function getIdempotencyKey(req: NextRequest): string {
  const key = req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
  if (!key || key.length < 8 || key.length > 200) {
    throw Errors.validation("A valid Idempotency-Key header is required for this operation");
  }
  return key;
}

/** Enforce a rate limit; throws Errors.rateLimited when exceeded. */
export function enforceRateLimit(
  req: NextRequest,
  bucket: string,
  config: { max: number; windowMs: number },
  identifier?: string,
): RateLimitResult {
  sweepRateLimiter();
  const ctx = getClientContext(req);
  const id = identifier ?? ctx.ip ?? "anon";
  const result = rateLimit(`${bucket}:${id}`, config);
  if (!result.ok) {
    throw new AppError(429, "RATE_LIMITED", "Too many requests, slow down", {
      retryAfterMs: Math.max(0, result.resetAt - Date.now()),
    });
  }
  return result;
}

/**
 * Wrap a route handler with uniform error handling. Usage:
 *   export const POST = route(async (req) => { ... return ok(data) })
 */
export function route(
  handler: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      // Defense-in-depth CSRF check for state-changing requests. Cookies are
      // SameSite=lax already; this additionally rejects cross-origin browser
      // requests. Non-browser clients (no Origin header) are unaffected.
      const method = req.method.toUpperCase();
      if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
        const origin = req.headers.get("origin");
        if (origin) {
          const host = req.headers.get("host");
          let originHost: string | null = null;
          try {
            originHost = new URL(origin).host;
          } catch {
            originHost = null;
          }
          if (host && originHost && originHost !== host) {
            return fail(new AppError(403, "CSRF", "Cross-origin request blocked"));
          }
        }
      }
      return await handler(req, ctx);
    } catch (err) {
      return fail(err);
    }
  };
}

export { Errors };
