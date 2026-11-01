"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, API_URL, CHANGED_EVENT } from "@/lib/api";
import type { Player, TournamentState } from "@/lib/types";

export function useTournamentData() {
  const [state, setState] = useState<TournamentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const again = useRef(false);

  // Coalesce bursts of change events into at most one extra fetch.
  const refresh = useCallback(async () => {
    if (inFlight.current) { again.current = true; return; }
    inFlight.current = true;
    try {
      do {
        again.current = false;
        setState(await api<TournamentState>("/api/state"));
        setError(null);
      } while (again.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const source = new EventSource(`${API_URL}/api/stream`);
    source.addEventListener("change", refresh);
    // After a dropped connection reconnects, catch up on anything missed.
    source.addEventListener("open", refresh);
    window.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      source.close();
      window.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  const playersByChurch = useMemo(() => {
    const map: Record<string, Player[]> = {};
    state?.players.forEach((p) => (map[p.churchId] ??= []).push(p));
    return map;
  }, [state]);

  return { state, error, playersByChurch };
}
