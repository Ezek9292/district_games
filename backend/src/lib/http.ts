import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { MulterError } from "multer";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
  } else if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? "Invalid request" });
  } else if (err instanceof MulterError) {
    res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "That photo is too large (max 5 MB)." : err.message });
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    res.status(404).json({ error: "Not found" });
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    res.status(409).json({ error: "That email is already used by another church." });
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
    res.status(400).json({ error: "Referenced church or game does not exist" });
  } else {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};
