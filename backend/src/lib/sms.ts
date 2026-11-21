import { env, isProduction } from "../env";
import { HttpError } from "./http";

/**
 * Login codes by SMS through mNotify (https://www.mnotify.com).
 * Needs MNOTIFY_API_KEY and an approved OTP sender ID (MNOTIFY_SENDER_ID, at most 11 characters, no hyphens),
 * registered in mNotify with the OTP URL https://districtgames.edonkor.dev.
 * Without a key, development prints the code to the console instead.
 */
export async function sendSmsCode(phone: string, code: string, churchName?: string) {
  const who = churchName ? `${churchName} team login code` : "organizer login code";
  const message = `Your Taifa District of SDA ${who} is ${code}. It expires in 10 minutes.`;

  if (!env.MNOTIFY_API_KEY) {
    if (isProduction) throw new HttpError(503, "Sign-in by phone isn't set up yet. Use your email address instead.");
    console.log(`[dev] Login code for ${phone}: ${code}`);
    return;
  }

  try {
    const res = await fetch(`https://api.mnotify.com/api/sms/quick?key=${encodeURIComponent(env.MNOTIFY_API_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        recipient: [phone.replace(/^\+/, "")],
        sender: env.MNOTIFY_SENDER_ID,
        message,
        // Marks the message as an OTP. mNotify only sends these from an approved OTP sender ID
        // (one registered with an otp_url, the site where the codes are used).
        sms_type: "otp",
        is_schedule: false,
        schedule_date: "",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const raw = await res.text();
    let data: { status?: string; code?: string; message?: string } | null = null;
    try { data = JSON.parse(raw); } catch {}
    if (!res.ok || data?.status !== "success") {
      // Keep mNotify's own words in the log (never the key, which is only in the URL).
      throw new SmsError(res.status, `mNotify answered ${res.status}: ${data?.message ?? (raw.slice(0, 300) || "empty reply")}`);
    }
  } catch (err) {
    if (!isProduction) {
      console.warn(`[dev] SMS to ${phone} failed (${(err as Error).message}). Login code: ${code}`);
      return;
    }
    console.error("Sending login code by SMS failed:", (err as Error).message);
    // 402: mNotify wants payment. OTP messages are paid from the account's main wallet.
    if (err instanceof SmsError && err.status === 402) {
      throw new HttpError(503, "Sign-in by SMS is paused: the SMS account is out of credit. Use your email address, or tell the organizers.");
    }
    // Not 502/504: Cloudflare may replace those with its own page, which the browser reports as "can't reach the server".
    throw new HttpError(503, "We couldn't send the code by SMS. Please try again later, or use your email address.");
  }
}

class SmsError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
