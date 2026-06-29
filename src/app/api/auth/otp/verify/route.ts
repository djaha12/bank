import { route, ok, parseBody, getClientContext, enforceRateLimit, Errors } from "@/lib/api";
import { otpVerifySchema } from "@/lib/validation";
import { verifyOtp } from "@/lib/auth";
import { createCustomerSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { OtpPurpose } from "@prisma/client";

export const POST = route(async (req) => {
  enforceRateLimit(req, "otp", { max: 10, windowMs: 60000 });
  const body = await parseBody(req, otpVerifySchema);
  const ctx = getClientContext(req);

  const purpose: OtpPurpose = body.purpose ?? OtpPurpose.LOGIN;
  const valid = await verifyOtp(body.email, body.code, purpose);
  if (!valid) throw Errors.unauthorized("Invalid or expired code");

  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase().trim() },
  });
  if (!user || user.deletedAt) throw Errors.notFound("No account found for this email");

  await createCustomerSession(user.id, {
    userAgent: ctx.userAgent,
    ip: ctx.ip,
  });

  return ok({ ok: true });
});
