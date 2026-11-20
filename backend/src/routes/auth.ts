import { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../lib/http";
import { sendLoginCode } from "../lib/mailer";
import { isPhoneLogin, parseLogin } from "../lib/login";
import { sendSmsCode } from "../lib/sms";
import { codesMatch, generateCode, hashCode, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS } from "../lib/otp";
import { findChurchSession, readToken, signToken, type Role } from "../middleware/auth";

export const authRouter = Router();

// Behind Cloudflare, req.ip is a Cloudflare edge shared by many visitors; the visitor's own IP is in CF-Connecting-IP.
const clientIp = (req: Request) => (req.get("cf-connecting-ip") ?? req.ip ?? "unknown").trim();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: clientIp,
});

/** The email or phone number being signed in with. Older clients send it as `email`. */
const loginFrom = (body: any) => parseLogin(body?.login ?? body?.email);
const roleSchema = z.enum(["organizer", "church"]).default("organizer");

// Same response whether or not the login is registered, so the lists can't be probed.
const sentMessage = (login: string) => ({
  message: isPhoneLogin(login)
    ? "If that number is registered, a 6-digit code is on its way by SMS."
    : "If that email is registered, a 6-digit code is on its way.",
});

/** Looks up who is signing in. */
async function findAccount(role: Role, login: string) {
  if (role === "church") {
    const rep = await prisma.churchEmail.findUnique({ where: { login }, include: { church: true } });
    return rep && { id: rep.church.id, name: rep.church.name };
  }
  const organizer = await prisma.organizer.findUnique({ where: { login } });
  return organizer && { id: organizer.id, name: organizer.name };
}

/** Codes are stored per role, so a church code can't sign in as an organizer with the same login. */
const otpKey = (role: Role, login: string) => (role === "church" ? `church:${login}` : login);

authRouter.post("/request-otp", limiter, async (req, res) => {
  const login = loginFrom(req.body);
  const role = roleSchema.parse(req.body?.as);
  const account = await findAccount(role, login);
  if (!account) {
    res.json(sentMessage(login));
    return;
  }

  const key = otpKey(role, login);
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
  const churchName = role === "church" ? account.name ?? undefined : undefined;
  if (isPhoneLogin(login)) await sendSmsCode(login, code, churchName);
  else await sendLoginCode(login, code, churchName);
  res.json(sentMessage(login));
});

authRouter.post("/verify-otp", limiter, async (req, res) => {
  const login = loginFrom(req.body);
  const role = roleSchema.parse(req.body?.as);
  const code = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code").parse(req.body?.code);
  const key = otpKey(role, login);

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

  const account = await findAccount(role, login);
  if (!account) throw new HttpError(400, "That code has expired. Request a new one.");

  const now = new Date();
  await prisma.$transaction([
    prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: now } }),
    role === "church"
      ? prisma.church.update({
          where: { id: account.id },
          data: { lastLoginAt: now, emails: { update: { where: { login }, data: { lastLoginAt: now } } } },
        })
      : prisma.organizer.update({ where: { id: account.id }, data: { lastLoginAt: now } }),
  ]);
  res.json({ token: signToken(role, account.id, login), ...(await sessionFor(role, account.id, login)) });
});

/** What the frontend needs to know about whoever is signed in. */
async function sessionFor(role: Role, id: string, login: string) {
  if (role === "church") {
    const church = await findChurchSession(id, login);
    return { role, church: { id: church.id, name: church.name, color: church.color, login } };
  }
  const organizer = await prisma.organizer.findUnique({ where: { id } });
  if (!organizer) throw new HttpError(401, "You are no longer an organizer.");
  return { role, organizer: { id: organizer.id, login: organizer.login, name: organizer.name, isSuper: organizer.isSuper } };
}

authRouter.get("/me", async (req, res) => {
  const token = readToken(req);
  if (!token) throw new HttpError(401, "Sign-in required");
  res.json(await sessionFor(token.role, token.id, token.login));
});
