"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { DIVISIONS, FORMATS } from "@/lib/formats";
import { errMessage } from "@/lib/utils";
import type { Division, Game, GameFormat } from "@/lib/types";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

/** Adds a game, or edits `game` — including the points it awards. */
export function GameModal({ game, onClose }: { game?: Game; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(game?.name ?? "");
  const [description, setDescription] = useState(game?.description ?? "");
  const [format, setFormat] = useState<GameFormat>(game?.format ?? "football");
  const [division, setDivision] = useState<Division>(game?.division ?? "men");
  const [eldersOnly, setEldersOnly] = useState(game?.eldersOnly ?? false);
  const [pointsWin, setPointsWin] = useState(String(game?.pointsWin ?? 3));
  const [pointsDraw, setPointsDraw] = useState(String(game?.pointsDraw ?? 1));
  const [pointsLoss, setPointsLoss] = useState(String(game?.pointsLoss ?? 0));

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { toast("Enter a game name."); return; }
    const body = {
      name: trimmed, description, format, division, eldersOnly,
      pointsWin: Number(pointsWin), pointsDraw: Number(pointsDraw), pointsLoss: Number(pointsLoss),
    };
    try {
      if (game) await api(`/api/games/${game.id}`, { method: "PATCH", body });
      else await api("/api/games", { method: "POST", body });
      onClose();
    } catch (e) { toast(errMessage(e)); }
  }

  const rulesChanged = game && (game.format !== format || game.division !== division || game.eldersOnly !== eldersOnly);
  const rules = FORMATS[format];

  return (
    <Modal onClose={onClose}>
      <h3>{game ? "Edit Game" : "Add Game"}</h3>
      <div className="field">
        <label className="field-label">Game name</label>
        <input placeholder="e.g. Men's Soccer" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field-label">Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as GameFormat)}>
            {(Object.keys(FORMATS) as GameFormat[]).map((f) => <option key={f} value={f}>{FORMATS[f].label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Who plays</label>
          <select value={division} onChange={(e) => setDivision(e.target.value as Division)}>
            {(Object.keys(DIVISIONS) as Division[]).map((d) => <option key={d} value={d}>{DIVISIONS[d]}</option>)}
          </select>
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={eldersOnly} onChange={(e) => setEldersOnly(e.target.checked)} />
        <span>Elders only</span>
      </label>
      <p className="muted" style={{ fontSize: 12.5 }}>
        Team sheet: {rules.starters} {format === "penalties" ? "kickers" : "starters"} + up to {rules.maxSubs} {format === "penalties" ? "reserves" : "substitutes"}.
      </p>
      {rulesChanged && (
        <p className="muted" style={{ fontSize: 12.5, color: "var(--danger)" }}>
          Changing these resets team sheets already submitted for this game&apos;s upcoming fixtures.
        </p>
      )}

      <div className="field-label" style={{ marginTop: 6 }}>Points awarded</div>
      <div className="field-row">
        <div className="field">
          <label className="field-label">Win</label>
          <input type="number" min={0} inputMode="numeric" value={pointsWin} onChange={(e) => setPointsWin(e.target.value)} />
        </div>
        {format === "football" && (
          <div className="field">
            <label className="field-label">Draw</label>
            <input type="number" min={0} inputMode="numeric" value={pointsDraw} onChange={(e) => setPointsDraw(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label className="field-label">Loss</label>
          <input type="number" min={0} inputMode="numeric" value={pointsLoss} onChange={(e) => setPointsLoss(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label className="field-label">Description (optional)</label>
        <textarea rows={2} placeholder="Rules, venue, duration…" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn accent" onClick={save}>{game ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}
