import { route, ok, parseBody, enforceRateLimit } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { registerUser, issueOtp } from "@/lib/auth";

export const POST = route(async (req) => {
  enforceRateLimit(req, "auth", { max: 10, windowMs: 60000 });
  const body = await parseBody(req, registerSchema);
  const user = await registerUser(body);
  const otp = await issueOtp(user.email, "SIGNUP");
  return ok({ userId: user.id, devCode: otp.devCode }, 201);
});
