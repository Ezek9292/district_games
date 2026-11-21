import nodemailer from "nodemailer";
import { env, isProduction } from "../env";
import { HttpError } from "./http";

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      // On other ports, refuse to send the code unencrypted.
      requireTLS: env.SMTP_PORT !== 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      // Fail fast instead of hanging (nodemailer waits up to 2 minutes by default, and Cloudflare cuts
      // requests off after 100 s, which the browser reports as "Can't reach the server"). A blocked SMTP
      // port, e.g. 25 or 465 on Hetzner, shows up here as a connection timeout.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  : null;

/** `churchName` is set when a church rep is signing in. */
export async function sendLoginCode(to: string, code: string, churchName?: string) {
  if (!transport) {
    console.log(`[dev] Login code for ${to}: ${code}`);
    return;
  }
  const who = churchName ? `${churchName} team login code` : "organizer login code";
  try {
    await transport.sendMail({
      from: env.MAIL_FROM,
      to,
      subject: `Your ${who}: ${code}`,
      text: `Your Taifa District of SDA ${who} is ${code}.\n\nIt expires in 10 minutes. If you didn't request it, you can ignore this email.`,
    });
  } catch (err) {
    // Locally, keep sign-in usable when the provider refuses a recipient
    // (e.g. Resend before a domain is verified).
    if (!isProduction) {
      console.warn(`[dev] Email to ${to} failed (${(err as Error).message}). Login code: ${code}`);
      return;
    }
    console.error("Sending login code failed:", err);
    // Not 502/504: Cloudflare may replace those with its own page ("can't reach the server" in the browser).
    throw new HttpError(503, "We couldn't send the code email. Please try again later.");
  }
}
