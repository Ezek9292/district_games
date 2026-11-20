import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  // Only reachable through Nginx on the same machine. Set HOST=0.0.0.0 to reach it from other devices.
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().min(1),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Taifa District of SDA <no-reply@example.com>"),
  // Login codes by SMS (mNotify). Without a key, phone sign-in is off in production.
  MNOTIFY_API_KEY: z.string().optional(),
  MNOTIFY_SENDER_ID: z.string().max(11, "MNOTIFY_SENDER_ID can be at most 11 characters").default("TaifaGames"),
  // These organizers (emails or phone numbers, comma-separated) are made super organizers at startup.
  ORGANIZER_EMAILS: z.string().default(""),
  // Player photos. Either the single CLOUDINARY_URL from the Cloudinary dashboard
  // (cloudinary://API_KEY:API_SECRET@CLOUD_NAME) or the three separate values.
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default("taifa-games/players"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const allowedOrigins = env.FRONTEND_ORIGIN.split(",").map((o) => o.trim());

if (isProduction && !env.SMTP_HOST) {
  console.error("SMTP_HOST is required in production so organizers can receive login codes.");
  process.exit(1);
}
