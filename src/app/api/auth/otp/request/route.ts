import { route, ok, parseBody, enforceRateLimit } from "@/lib/api";
import { otpRequestSchema } from "@/lib/validation";
import { issueOtp } from "@/lib/auth";
import { OtpPurpose } from "@prisma/client";

export const POST = route(async (req) => {
  enforceRateLimit(req, "otp", { max: 5, windowMs: 60000 });
  const body = await parseBody(req, otpRequestSchema);
  const purpose: OtpPurpose = body.purpose ?? OtpPurpose.LOGIN;
  const result = await issueOtp(body.email, purpose);
  return ok({ delivered: result.delivered, devCode: result.devCode });
});
