import { z } from "zod";
import { HttpError } from "./http";

/**
 * People sign in with an email address or a phone number. Both are stored in one `login` field:
 * emails in lower case, phone numbers in international form (+233241234567).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "024 123 4567", "+233 24 123 4567" and "233241234567" all become "+233241234567". */
export function normalizePhone(raw: string): string | null {
  const s = raw.trim().replace(/[\s\-().]/g, "");
  if (/^0\d{9}$/.test(s)) return "+233" + s.slice(1); // Ghanaian local format
  if (/^233\d{9}$/.test(s)) return "+" + s;
  if (/^00\d{8,15}$/.test(s)) return "+" + s.slice(2);
  if (/^\+\d{8,15}$/.test(s)) return s;
  return null;
}

/** Returns the stored form of an email or phone number, or null if it is neither. */
export function normalizeLogin(raw: string): string | null {
  const s = raw.trim();
  if (s.includes("@")) return EMAIL_RE.test(s) ? s.toLowerCase() : null;
  return normalizePhone(s);
}

export const isPhoneLogin = (login: string) => login.startsWith("+");

/** Zod schema: an email or phone number, normalized. */
export const loginSchema = (message = "Enter a valid email address or phone number") =>
  z.string().transform((v, ctx) => {
    const login = normalizeLogin(v);
    if (!login) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
      return z.NEVER;
    }
    return login;
  });

export function parseLogin(raw: unknown): string {
  const login = normalizeLogin(String(raw ?? ""));
  if (!login) throw new HttpError(400, "Enter a valid email address or phone number");
  return login;
}
