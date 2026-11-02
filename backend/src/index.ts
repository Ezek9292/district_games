import express from "express";
import cors from "cors";
import helmet from "helmet";
import { allowedOrigins, env } from "./env";
import { prisma } from "./prisma";
import { errorHandler } from "./lib/http";
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

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT} ✅`);
});
