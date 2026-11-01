import crypto from "crypto";
import { env } from "../env";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashCode(email: string, code: string): string {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(`${email}:${code}`).digest("hex");
}

export function codesMatch(hashA: string, hashB: string): boolean {
  const a = Buffer.from(hashA, "hex");
  const b = Buffer.from(hashB, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
