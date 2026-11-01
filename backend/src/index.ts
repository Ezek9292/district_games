import express from "express";
import cors from "cors";
import { allowedOrigins, env } from "./env";
import { errorHandler } from "./lib/http";
import { authRouter } from "./routes/auth";
import { publicRouter } from "./routes/public";
import { adminRouter } from "./routes/admin";
import { churchRouter } from "./routes/church";

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => { res.json({ ok: true }); });
app.use("/api/auth", authRouter);
app.use("/api/church", churchRouter);
app.use("/api", publicRouter);
app.use("/api", adminRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
