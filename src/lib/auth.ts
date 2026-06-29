import { KycStatus, OtpPurpose, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { generateOtp, hashOtp, hashPassword, verifyPassword } from "@/lib/crypto";
import { getCustomerSession, touchCustomerSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export interface AuthedUser {
  id: string;
  email: string;
  status: UserStatus;
  kycStatus: KycStatus;
  sessionId: string;
  firstName?: string | null;
  lastName?: string | null;
}

/** Resolve the current customer from the session cookie, or null. */
export async function getCurrentUser(): Promise<AuthedUser | null> {
  const session = await getCustomerSession();
  if (!session) return null;
  // Best-effort last-seen update (don't block the request).
  void touchCustomerSession(session.id);
  return {
    id: session.user.id,
    email: session.user.email,
    status: session.user.status,
    kycStatus: session.user.kycStatus,
    sessionId: session.id,
    firstName: session.user.profile?.firstName,
    lastName: session.user.profile?.lastName,
  };
}

export async function requireUser(): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  if (user.status !== UserStatus.ACTIVE) throw Errors.blocked(`Account is ${user.status}`);
  return user;
}

/** Endpoints that move money / issue cards require an approved KYC. */
export async function requireKycApprovedUser(): Promise<AuthedUser> {
  const user = await requireUser();
  if (user.kycStatus !== KycStatus.APPROVED) {
    throw Errors.kycRequired("Complete identity verification to use this feature");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Registration + OTP (mock)
// ---------------------------------------------------------------------------

export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw Errors.conflict("An account with this email already exists");

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashPassword(input.password),
      status: UserStatus.ACTIVE,
      kycStatus: KycStatus.NOT_STARTED,
      profile: { create: { firstName: input.firstName, lastName: input.lastName } },
    },
  });
  await writeAudit({
    actorType: "USER",
    actorId: user.id,
    action: "auth.register",
    entity: "User",
    entityId: user.id,
    after: { email },
  });
  return user;
}

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || user.deletedAt) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}

const OTP_TTL = Number(process.env.OTP_TTL_SECONDS ?? 300);

/**
 * Issue an OTP challenge. With OTP_PROVIDER=mock the code is logged to the
 * server console and returned to the caller ONLY in non-production so the demo
 * is usable. A real provider would deliver out-of-band and never return it.
 */
export async function issueOtp(email: string, purpose: OtpPurpose) {
  const normalized = email.toLowerCase().trim();
  const code = generateOtp(6);
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  await prisma.otpChallenge.create({
    data: {
      email: normalized,
      userId: user?.id,
      purpose,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL * 1000),
    },
  });
  // Mock delivery.
  // eslint-disable-next-line no-console
  console.info(`[OTP mock] ${purpose} code for ${normalized}: ${code}`);
  const exposeForDemo = process.env.NODE_ENV !== "production";
  return { delivered: true, devCode: exposeForDemo ? code : undefined };
}

export async function verifyOtp(email: string, code: string, purpose: OtpPurpose) {
  const normalized = email.toLowerCase().trim();
  const challenge = await prisma.otpChallenge.findFirst({
    where: { email: normalized, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return false;
  if (challenge.attempts >= 5) return false;
  const ok = challenge.codeHash === hashOtp(code);
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { attempts: { increment: 1 }, consumedAt: ok ? new Date() : null },
  });
  return ok;
}
