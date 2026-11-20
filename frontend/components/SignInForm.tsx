"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errMessage } from "@/lib/utils";
import type { Session } from "@/lib/types";
import { useAuth } from "./Auth";
import { useToast } from "./Toast";

/** Email or phone number → 6-digit code sign-in, shared by organizers and church reps. */
export function SignInForm({
  as, intro, onCancel, onSignedIn,
}: {
  as: Session["role"];
  intro: string;
  onCancel?: () => void;
  onSignedIn?: () => void;
}) {
  const toast = useToast();
  const { signIn } = useAuth();
  const [step, setStep] = useState<"login" | "code">("login");
  const [login, setLogin] = useState("");
  const isPhone = !login.includes("@");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    if (!login.trim()) { toast("Enter your email or phone number."); return; }
    setBusy(true);
    try {
      const r = await api<{ message: string }>("/api/auth/request-otp", { method: "POST", body: { login, as } });
      toast(r.message);
      setStep("code");
    } catch (e) { toast(errMessage(e)); }
    finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true);
    try {
      const { token, ...session } = await api<{ token: string } & Session>("/api/auth/verify-otp", {
        method: "POST", body: { login, code, as },
      });
      signIn(token, session as Session);
      onSignedIn?.();
    } catch (e) { toast(errMessage(e)); }
    finally { setBusy(false); }
  }

  return step === "login" ? (
    <>
      <p className="muted">{intro}</p>
      <div className="field">
        <label className="field-label" htmlFor="signin-login">Email or phone number</label>
        <input
          id="signin-login" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus
          placeholder="you@example.com or 024 123 4567" value={login}
          onChange={(e) => setLogin(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") requestCode(); }}
        />
      </div>
      <div className="modal-actions">
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}
        <button type="button" className="btn accent" onClick={requestCode} disabled={busy}>Send code</button>
      </div>
    </>
  ) : (
    <>
      <p className="muted">
        Enter the code sent {isPhone ? "by SMS " : ""}to <strong>{login}</strong>. It expires in 10 minutes.
      </p>
      <div className="field">
        <input
          className="pin-display" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
          placeholder="••••••" value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
        />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={() => { setStep("login"); setCode(""); }}>Back</button>
        <button type="button" className="btn ghost" onClick={requestCode} disabled={busy}>Resend</button>
        <button type="button" className="btn accent" onClick={verify} disabled={busy || code.length !== 6}>Sign in</button>
      </div>
    </>
  );
}
