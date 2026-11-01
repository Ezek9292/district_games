import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../lib/http";
import { sendLoginCode } from "../lib/mailer";
import { codesMatch, generateCode, hashCode, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS } from "../lib/otp";
import { readToken, signToken, type Role } from "../middleware/auth";

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false });

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");
const roleSchema = z.enum(["organizer", "church"]).default("organizer");

// Same response whether or not the email is registered, so the lists can't be probed.
const GENERIC_SENT = { message: "If that email is registered, a 6-digit code is on its way." };

/** Looks up who is signing in. */
async function findAccount(role: Role, email: string) {
  if (role === "church") {
    const church = await prisma.church.findUnique({ where: { email } });
    return church && { id: church.id, email, name: church.name };
  }
  const organizer = await prisma.organizer.findUnique({ where: { email } });
  return organizer && { id: organizer.id, email, name: organizer.name };
}

/** Codes are stored per role, so a church code can't sign in as an organizer with the same email. */
const otpKey = (role: Role, email: string) => (role === "church" ? `church:${email}` : email);

authRouter.post("/request-otp", limiter, async (req, res) => {
  const email = emailSchema.parse(req.body?.email);
  const role = roleSchema.parse(req.body?.as);
  const account = await findAccount(role, email);
  if (!account) {
    res.json(GENERIC_SENT);
    return;
  }

  const key = otpKey(role, email);
  const recent = await prisma.otpCode.findFirst({
    where: { email: key, createdAt: { gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) } },
  });
  if (recent) throw new HttpError(429, "Please wait a minute before requesting another code.");

  const code = generateCode();
  await prisma.$transaction([
    prisma.otpCode.updateMany({ where: { email: key, consumedAt: null }, data: { consumedAt: new Date() } }),
    prisma.otpCode.create({
      data: { email: key, codeHash: hashCode(key, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    }),
  ]);
  await sendLoginCode(email, code, role === "church" ? account.name ?? undefined : undefined);
  res.json(GENERIC_SENT);
});

authRouter.post("/verify-otp", limiter, async (req, res) => {
  const email = emailSchema.parse(req.body?.email);
  const role = roleSchema.parse(req.body?.as);
  const code = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code").parse(req.body?.code);
  const key = otpKey(role, email);

  const otp = await prisma.otpCode.findFirst({
    where: { email: key, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new HttpError(400, "That code has expired. Request a new one.");
  }
  if (!codesMatch(otp.codeHash, hashCode(key, code))) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, "That code doesn't match.");
  }

  const account = await findAccount(role, email);
  if (!account) throw new HttpError(400, "That code has expired. Request a new one.");

  const now = new Date();
  await prisma.$transaction([
    prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: now } }),
    role === "church"
      ? prisma.church.update({ where: { id: account.id }, data: { lastLoginAt: now } })
      : prisma.organizer.update({ where: { id: account.id }, data: { lastLoginAt: now } }),
  ]);
  res.json({ token: signToken(role, account.id, email), ...(await sessionFor(role, account.id)) });
});

/** What the frontend needs to know about whoever is signed in. */
async function sessionFor(role: Role, id: string) {
  if (role === "church") {
    const church = await prisma.church.findUnique({ where: { id } });
    if (!church) throw new HttpError(401, "This church is no longer registered.");
    return { role, church: { id: church.id, name: church.name, color: church.color, email: church.email } };
  }
  const organizer = await prisma.organizer.findUnique({ where: { id } });
  if (!organizer) throw new HttpError(401, "You are no longer an organizer.");
  return { role, organizer: { id: organizer.id, email: organizer.email, name: organizer.name } };
}

authRouter.get("/me", async (req, res) => {
  const token = readToken(req);
  if (!token) throw new HttpError(401, "Sign-in required");
  res.json(await sessionFor(token.role, token.id));
});
