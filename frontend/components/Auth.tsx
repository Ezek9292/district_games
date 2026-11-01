"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, tokenKey, UNAUTHORIZED_EVENT, type Role } from "@/lib/api";
import type { ChurchAccount, Organizer, Session } from "@/lib/types";

type AuthValue = {
  /** False until stored tokens have been checked, so pages don't flash the sign-in form. */
  ready: boolean;
  organizer: Organizer | null;
  church: ChurchAccount | null;
  signIn: (token: string, session: Session) => void;
  signOut: (role: Role) => void;
};

const AuthContext = createContext<AuthValue>({
  ready: false, organizer: null, church: null, signIn: () => {}, signOut: () => {},
});

const ROLES: Role[] = ["organizer", "church"];

/** Organizer and church sessions are independent: signing in or out of one never touches the other. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [organizer, setOrganizer] = useState<Organizer | null>(null);
  const [church, setChurch] = useState<ChurchAccount | null>(null);
  const [ready, setReady] = useState(false);

  const apply = useCallback((role: Role, s: Session | null) => {
    if (role === "organizer") setOrganizer(s?.role === "organizer" ? s.organizer : null);
    else setChurch(s?.role === "church" ? s.church : null);
  }, []);

  /** Loads the session behind a role's stored token (or clears it when there is none). */
  const load = useCallback(async (role: Role) => {
    if (!getToken(role)) { apply(role, null); return; }
    const s = await api<Session>("/api/auth/me", { as: role }).catch(() => null);
    apply(role, s?.role === role ? s : null);
  }, [apply]);

  const signOut = useCallback((role: Role) => {
    setToken(role, null);
    apply(role, null);
  }, [apply]);

  const signIn = useCallback((token: string, s: Session) => {
    setToken(s.role, token);
    apply(s.role, s);
  }, [apply]);

  useEffect(() => {
    try { localStorage.removeItem("scg_token"); } catch {} // pre-split shared token
    Promise.all(ROLES.map(load)).finally(() => setReady(true));

    const onUnauthorized = (e: Event) => signOut((e as CustomEvent<Role>).detail);
    // Keep other tabs in step when one signs in or out.
    const onStorage = (e: StorageEvent) => {
      const role = ROLES.find((r) => tokenKey(r) === e.key);
      if (role) load(role);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.removeEventListener("storage", onStorage);
    };
  }, [load, signOut]);

  return (
    <AuthContext.Provider value={{ ready, organizer, church, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
