import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { Church, Organizer } from "@prisma/client";
import { env } from "../env";
import { prisma } from "../prisma";
import { HttpError } from "../lib/http";

declare global {
  namespace Express {
    interface Request {
      organizer?: Organizer;
      church?: Church;
    }
  }
}

export type Role = "organizer" | "church";

export const TOKEN_TTL = "7d";

/** `login` is the email or phone number signed in with (kept in the `email` claim, as older tokens have it). */
export function signToken(role: Role, id: string, login: string): string {
  return jwt.sign({ sub: id, email: login, role }, env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/** Reads the bearer token. Tokens issued before church sign-in existed carry no role and are organizers. */
export function readToken(req: Request): { role: Role; id: string; login: string } | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    return {
      role: payload.role === "church" ? "church" : "organizer",
      id: String(payload.sub),
      login: String(payload.email ?? ""),
    };
  } catch {
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }
}

/** Rejects the request unless it carries a valid token for an organizer that still exists. */
export const requireOrganizer: RequestHandler = async (req, _res, next) => {
  const token = readToken(req);
  if (token?.role !== "organizer") throw new HttpError(401, "Organizer sign-in required");
  const organizer = await prisma.organizer.findUnique({ where: { id: token.id } });
  if (!organizer) throw new HttpError(401, "You are no longer an organizer.");
  req.organizer = organizer;
  next();
};

/** For routes only a super organizer may use; runs after requireOrganizer. */
export const requireSuperOrganizer: RequestHandler = (req, _res, next) => {
  if (!req.organizer?.isSuper) throw new HttpError(403, "Only the super organizer can do this.");
  next();
};

/** The signed-in organizer, if the request carries a valid organizer token; never throws. */
export async function optionalOrganizer(req: Request): Promise<Organizer | null> {
  try {
    const token = readToken(req);
    if (token?.role !== "organizer") return null;
    return await prisma.organizer.findUnique({ where: { id: token.id } });
  } catch {
    return null;
  }
}

/** The church behind a church session, as long as the login it signed in with is still one of the church's. */
export async function findChurchSession(churchId: string, login: string): Promise<Church> {
  const rep = login ? await prisma.churchEmail.findUnique({ where: { login }, include: { church: true } }) : null;
  if (!rep || rep.churchId !== churchId) {
    throw new HttpError(401, "This email or phone number is no longer registered for the church. Ask an organizer to add it.");
  }
  return rep.church;
}

/** Rejects the request unless it carries a valid token for a church login that is still registered. */
export const requireChurch: RequestHandler = async (req, _res, next) => {
  const token = readToken(req);
  if (token?.role !== "church") throw new HttpError(401, "Church sign-in required");
  req.church = await findChurchSession(token.id, token.login);
  next();
};
