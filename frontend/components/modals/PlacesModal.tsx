"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ordinal, placePoints, pointsSummary } from "@/lib/formats";
import { errMessage } from "@/lib/utils";
import type { Church, Fixture, Game } from "@/lib/types";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

/**
 * Organizer records where each church finished in an all-church event. Two churches can share
 * a place (a dead heat). Leaving a church on "Didn't finish" gives it no points.
 */
export function PlacesModal({
  fixture, game, churches, onClose,
}: {
  fixture: Fixture;
  game: Game | undefined;
  churches: Church[];
  onClose: () => void;
}) {
  const toast = useToast();
  const entries = fixture.entries ?? [];
  const [places, setPlaces] = useState<Record<string, string>>(() =>
    Object.fromEntries(entries.map((e) => [e.churchId, e.place ? String(e.place) : ""]))
  );
  const [scoreNote, setScoreNote] = useState(fixture.scoreNote);
  const [busy, setBusy] = useState(false);

  const churchById = (id: string) => churches.find((c) => c.id === id);
  const anyPlaced = Object.values(places).some(Boolean);
  const taken = (n: number) => Object.values(places).filter((p) => p === String(n)).length;

  async function save(clear = false) {
    setBusy(true);
    try {
      const body = clear
        ? { places: null, scoreNote }
        : { places: Object.fromEntries(entries.map((e) => [e.churchId, places[e.churchId] ? Number(places[e.churchId]) : null])), scoreNote };
      await api(`/api/fixtures/${fixture.id}/places`, { method: "PUT", body });
      toast(clear ? "Places cleared." : "Places saved.");
      onClose();
    } catch (e) { toast(errMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose}>
      <h3>Enter Places</h3>
      <p className="muted">
        {game?.name ?? "Event"}{game && <>. Points: {pointsSummary(game)}.</>}
      </p>
      <ol className="place-list">
        {entries.map((e) => {
          const c = churchById(e.churchId);
          const value = places[e.churchId] ?? "";
          const pts = placePoints(game, value ? Number(value) : null);
          return (
            <li key={e.churchId} className="place-row">
              <label htmlFor={`place-${e.churchId}`} className="church-chip">
                <span className="swatch" style={{ background: c?.color }} aria-hidden="true" />
                <span>{c?.name ?? "Removed church"}{value && <span className="muted"> · {pts} {pts === 1 ? "pt" : "pts"}</span>}</span>
              </label>
              <select
                id={`place-${e.churchId}`} value={value}
                onChange={(ev) => setPlaces((p) => ({ ...p, [e.churchId]: ev.target.value }))}
              >
                <option value="">Didn&apos;t finish</option>
                {entries.map((_, i) => (
                  <option key={i} value={String(i + 1)}>
                    {ordinal(i + 1)}{taken(i + 1) && value !== String(i + 1) ? " (tie)" : ""}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ol>
      <div className="field">
        <label className="field-label" htmlFor="place-note">Note (optional)</label>
        <input id="place-note" placeholder="e.g. Winning time 12.4 s" maxLength={40} value={scoreNote} onChange={(e) => setScoreNote(e.target.value)} />
      </div>
      <div className="modal-actions">
        {fixture.status === "final" && (
          <button type="button" className="btn danger" onClick={() => save(true)} disabled={busy}>Clear places</button>
        )}
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn accent" onClick={() => save()} disabled={busy || !anyPlaced}>Save places</button>
      </div>
    </Modal>
  );
}
