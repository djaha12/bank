import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  createHmac,
} from "node:crypto";

/**
 * Password hashing with scrypt (no native deps). Format:
 *   scrypt$N$saltHex$hashHex
 * This is a SANDBOX mock — real auth should prefer passkeys (WebAuthn) and a
 * vetted KDF (argon2id) with server-side pepper in an HSM/KMS (see SECURITY.md).
 */
const SCRYPT_N = 16384;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const salt = Buffer.from(parts[2] ?? "", "hex");
  const expected = Buffer.from(parts[3] ?? "", "hex");
  const actual = scryptSync(password, salt, expected.length, { N });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** URL-safe random token (used for session tokens, never stored raw). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function pepper(): string {
  return process.env.SESSION_SECRET ?? "dev-pepper";
}

/** Hash an OTP code with a server-side pepper before storage/compare. */
export function hashOtp(code: string): string {
  return createHmac("sha256", pepper()).update(code).digest("hex");
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Generate a numeric OTP of `digits` length (mock). */
export function generateOtp(digits = 6): string {
  const max = 10 ** digits;
  const n = randomBytes(4).readUInt32BE(0) % max;
  return n.toString().padStart(digits, "0");
}
