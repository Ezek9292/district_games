"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { fixtureChurchIds, isRace } from "@/lib/formats";
import { errMessage } from "@/lib/utils";
import type { Church, Fixture, Game } from "@/lib/types";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

/**
 * Adds or edits a fixture. Two-church matches pick church A and B; all-church events
 * (100 m, sack race...) tick every church taking part, all of them by default.
 */
export function FixtureModal({
  fixture, churches, games, onClose,
}: {
  fixture: Fixture | null;
  churches: Church[];
  games: Game[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [gameId, setGameId] = useState(fixture?.gameId ?? games[0]?.id ?? "");
  // Semi-finals and the final may not know their churches yet ("To be decided").
  const knockout = fixture?.stage === "semi" || fixture?.stage === "final";
  const [churchAId, setChurchAId] = useState(fixture ? fixture.churchAId ?? (knockout ? "" : churches[0]?.id ?? "") : churches[0]?.id ?? "");
  const [churchBId, setChurchBId] = useState(fixture ? fixture.churchBId ?? (knockout ? "" : churches[1]?.id ?? "") : churches[1]?.id ?? churches[0]?.id ?? "");
  const [entered, setEntered] = useState<string[]>(() => {
    const ids = fixture ? fixtureChurchIds(fixture) : [];
    return fixture?.entries?.length ? ids : churches.map((c) => c.id);
  });
  const [round, setRound] = useState(fixture?.round ?? "");
  const [time, setTime] = useState(fixture?.time ?? "");
  const [location, setLocation] = useState(fixture?.location ?? "");

  const game = games.find((g) => g.id === gameId);
  const race = isRace(game);

  function toggle(id: string) {
    setEntered((list) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function save() {
    if (race && entered.length < 2) { toast("Tick at least 2 churches."); return; }
    if (!race && churchAId && churchAId === churchBId) { toast("Church A and B must differ."); return; }
    if (!race && !knockout && (!churchAId || !churchBId)) { toast("Pick both churches."); return; }
    const body = race
      ? { gameId, churchIds: churches.map((c) => c.id).filter((id) => entered.includes(id)), round, time, location }
      : { gameId, churchAId: churchAId || null, churchBId: churchBId || null, round, time, location };
    try {
      if (fixture) await api(`/api/fixtures/${fixture.id}`, { method: "PUT", body });
      else await api("/api/fixtures", { method: "POST", body });
      onClose();
    } catch (e) { toast(errMessage(e)); }
  }

  const churchOpts = [
    ...(knockout ? [<option key="tbd" value="">To be decided</option>] : []),
    ...churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>),
  ];
  const title = race ? "Event" : "Fixture";

  return (
    <Modal onClose={onClose}>
      <h3>{fixture ? `Edit ${title}` : `Add ${title}`}</h3>
      <div className="field">
        <label className="field-label" htmlFor="fx-game">Game</label>
        <select id="fx-game" value={gameId} onChange={(e) => setGameId(e.target.value)}>
          {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      {race ? (
        <fieldset className="field">
          <legend className="field-label">Churches taking part</legend>
          <p className="muted hint">All churches compete together and are ranked 1st, 2nd, 3rd…</p>
          <div className="entry-picks">
            {churches.map((c) => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={entered.includes(c.id)} onChange={() => toggle(c.id)} />
                <span className="swatch" style={{ background: c.color }} aria-hidden="true" />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="fx-a">Church A</label>
            <select id="fx-a" value={churchAId} onChange={(e) => setChurchAId(e.target.value)}>{churchOpts}</select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="fx-b">Church B</label>
            <select id="fx-b" value={churchBId} onChange={(e) => setChurchBId(e.target.value)}>{churchOpts}</select>
          </div>
        </div>
      )}
      <div className="field">
        <label className="field-label" htmlFor="fx-round">Round / group label</label>
        <input id="fx-round" placeholder={race ? "e.g. Final" : "e.g. Round 1"} value={round} onChange={(e) => setRound(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field-label" htmlFor="fx-time">Time</label>
          <input id="fx-time" placeholder="e.g. 10:30 AM" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="fx-loc">Location</label>
          <input id="fx-loc" placeholder={race ? "e.g. Track" : "e.g. Field 2"} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn accent" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}
