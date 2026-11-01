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

export function signToken(role: Role, id: string, email: string): string {
  return jwt.sign({ sub: id, email, role }, env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

/** Reads the bearer token. Tokens issued before church sign-in existed carry no role and are organizers. */
export function readToken(req: Request): { role: Role; id: string } | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload;
    return { role: payload.role === "church" ? "church" : "organizer", id: String(payload.sub) };
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

/** Rejects the request unless it carries a valid token for a church that still exists. */
export const requireChurch: RequestHandler = async (req, _res, next) => {
  const token = readToken(req);
  if (token?.role !== "church") throw new HttpError(401, "Church sign-in required");
  const church = await prisma.church.findUnique({ where: { id: token.id } });
  if (!church) throw new HttpError(401, "This church is no longer registered.");
  req.church = church;
  next();
};
