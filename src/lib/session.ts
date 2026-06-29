import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

export const CUSTOMER_COOKIE = "nb_session";
export const ADMIN_COOKIE = "nb_admin";

const TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 12);
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret");

const baseCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// ---------------------------------------------------------------------------
// Customer sessions — DB-backed (device list / revoke / trust). The raw token
// lives only in the cookie; the DB stores its SHA-256 hash.
// ---------------------------------------------------------------------------

export async function createCustomerSession(
  userId: string,
  ctx: { deviceName?: string; userAgent?: string | null; ip?: string | null; trusted?: boolean },
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000);
  const session = await prisma.deviceSession.create({
    data: {
      userId,
      tokenHash: sha256(token),
      deviceName: ctx.deviceName,
      userAgent: ctx.userAgent ?? undefined,
      ipAddress: ctx.ip ?? undefined,
      trusted: ctx.trusted ?? false,
      expiresAt,
    },
  });
  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, { ...baseCookie, expires: expiresAt });
  return { token, sessionId: session.id, expiresAt };
}

export async function getCustomerSession() {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.deviceSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { profile: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  if (session.user.deletedAt) return null;
  return session;
}

export async function touchCustomerSession(sessionId: string) {
  await prisma.deviceSession
    .update({ where: { id: sessionId }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);
}

export async function destroyCustomerSession() {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (token) {
    await prisma.deviceSession
      .updateMany({ where: { tokenHash: sha256(token) }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }
  store.delete(CUSTOMER_COOKIE);
}

// ---------------------------------------------------------------------------
// Admin sessions — stateless signed JWT (short-lived). Admin actions are still
// fully audit-logged at the handler level.
// ---------------------------------------------------------------------------

export async function createAdminSession(adminUserId: string) {
  const token = await new SignJWT({ sub: adminUserId, kind: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_HOURS}h`)
    .sign(secret());
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    ...baseCookie,
    expires: new Date(Date.now() + TTL_HOURS * 3600 * 1000),
  });
}

export async function getAdminIdFromSession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function destroyAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
