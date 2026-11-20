import express from "express";
import cors from "cors";
import helmet from "helmet";
import { allowedOrigins, env } from "./env";
import { prisma } from "./prisma";
import { errorHandler } from "./lib/http";
import { normalizeLogin } from "./lib/login";
import { authRouter } from "./routes/auth";
import { publicRouter } from "./routes/public";
import { adminRouter } from "./routes/admin";
import { churchRouter } from "./routes/church";

const app = express();
app.set("trust proxy", 1);
// The frontend lives on another origin, so let it read our responses.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "100kb" }));

// Also checks the database, so uptime monitors notice when Supabase is unreachable.
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (err) {
    console.error("Health check: database unreachable", err);
    res.status(503).json({ ok: false, error: "database unreachable" });
  }
});
app.use("/api/auth", authRouter);
app.use("/api/church", churchRouter);
app.use("/api", publicRouter);
app.use("/api", adminRouter);

app.use(errorHandler);

app.listen(env.PORT, env.HOST, () => {
  console.log(`API listening on http://${env.HOST}:${env.PORT} ✅`);
  syncSuperOrganizers().catch((err) => console.error("Couldn't set the super organizers:", err));
});

/**
 * The organizers in ORGANIZER_EMAILS (emails or phone numbers) are super organizers: they approve
 * results the other organizers enter. If none is listed or found, the earliest organizer is made super,
 * so results can always be approved.
 */
async function syncSuperOrganizers() {
  const logins = env.ORGANIZER_EMAILS.split(",").map((v) => normalizeLogin(v)).filter((v): v is string => !!v);
  for (const login of logins) {
    await prisma.organizer.upsert({ where: { login }, update: { isSuper: true }, create: { login, isSuper: true } });
  }
  if (!(await prisma.organizer.count({ where: { isSuper: true } }))) {
    const first = await prisma.organizer.findFirst({ orderBy: { createdAt: "asc" } });
    if (first) await prisma.organizer.update({ where: { id: first.id }, data: { isSuper: true } });
  }
}
