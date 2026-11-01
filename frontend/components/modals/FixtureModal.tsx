"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errMessage } from "@/lib/utils";
import type { Church, Fixture, Game } from "@/lib/types";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

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
  const [churchAId, setChurchAId] = useState(fixture?.churchAId ?? churches[0]?.id ?? "");
  const [churchBId, setChurchBId] = useState(fixture?.churchBId ?? churches[0]?.id ?? "");
  const [round, setRound] = useState(fixture?.round ?? "");
  const [time, setTime] = useState(fixture?.time ?? "");
  const [location, setLocation] = useState(fixture?.location ?? "");

  async function save() {
    if (churchAId === churchBId) { toast("Church A and B must differ."); return; }
    const body = { gameId, churchAId, churchBId, round, time, location };
    try {
      if (fixture) await api(`/api/fixtures/${fixture.id}`, { method: "PUT", body });
      else await api("/api/fixtures", { method: "POST", body });
      onClose();
    } catch (e) { toast(errMessage(e)); }
  }

  const churchOpts = churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>);

  return (
    <Modal onClose={onClose}>
      <h3>{fixture ? "Edit Fixture" : "Add Fixture"}</h3>
      <div className="field">
        <label className="field-label">Game</label>
        <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
          {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field-label">Church A</label>
          <select value={churchAId} onChange={(e) => setChurchAId(e.target.value)}>{churchOpts}</select>
        </div>
        <div className="field">
          <label className="field-label">Church B</label>
          <select value={churchBId} onChange={(e) => setChurchBId(e.target.value)}>{churchOpts}</select>
        </div>
      </div>
      <div className="field">
        <label className="field-label">Round / group label</label>
        <input placeholder="e.g. Round 1" value={round} onChange={(e) => setRound(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field-label">Time</label>
          <input placeholder="e.g. 10:30 AM" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Location</label>
          <input placeholder="e.g. Field 2" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn accent" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}
