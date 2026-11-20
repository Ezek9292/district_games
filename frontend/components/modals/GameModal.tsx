"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { DEFAULT_PLACE_POINTS, DIVISIONS, FORMAT_KEYS, FORMATS, ordinal } from "@/lib/formats";
import { errMessage } from "@/lib/utils";
import type { Division, Game, GameFormat } from "@/lib/types";

/** Drops trailing zero places so the list stays short; keeps at least 1st. */
function trimZeros(list: number[]) {
  let end = list.length;
  while (end > 1 && list[end - 1] === 0) end--;
  return list.slice(0, end);
}
import { Modal } from "../Modal";
import { useToast } from "../Toast";

/** Adds a game, or edits `game`, including the points it awards. */
export function GameModal({ game, churchCount, onClose }: { game?: Game; churchCount: number; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(game?.name ?? "");
  const [description, setDescription] = useState(game?.description ?? "");
  const [format, setFormat] = useState<GameFormat>(game?.format ?? "football");
  const [division, setDivision] = useState<Division>(game?.division ?? "men");
  const [eldersOnly, setEldersOnly] = useState(game?.eldersOnly ?? false);
  const [pointsWin, setPointsWin] = useState(String(game?.pointsWin ?? 3));
  const [pointsDraw, setPointsDraw] = useState(String(game?.pointsDraw ?? 1));
  const [pointsLoss, setPointsLoss] = useState(String(game?.pointsLoss ?? 0));
  // One box per place a church could finish in (at least 1st to 4th).
  const [pointsPlaces, setPointsPlaces] = useState<string[]>(() => {
    const saved = game?.pointsPlaces?.length ? game.pointsPlaces : DEFAULT_PLACE_POINTS;
    const n = Math.min(Math.max(4, churchCount, saved.length), 30);
    return Array.from({ length: n }, (_, i) => String(saved[i] ?? 0));
  });

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { toast("Enter a game name."); return; }
    const body = {
      name: trimmed, description, format, division, eldersOnly,
      pointsWin: Number(pointsWin), pointsDraw: Number(pointsDraw), pointsLoss: Number(pointsLoss),
      pointsPlaces: trimZeros(pointsPlaces.map((p) => Number(p) || 0)),
    };
    try {
      if (game) await api(`/api/games/${game.id}`, { method: "PATCH", body });
      else await api("/api/games", { method: "POST", body });
      onClose();
    } catch (e) { toast(errMessage(e)); }
  }

  const rulesChanged = game && (game.format !== format || game.division !== division || game.eldersOnly !== eldersOnly);
  const rules = FORMATS[format];
  const race = rules.kind === "race";
  const kindChanged = game && FORMATS[game.format].kind !== rules.kind;

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
            <optgroup label="Two churches play each other">
              {FORMAT_KEYS.filter((f) => FORMATS[f].kind === "match").map((f) => <option key={f} value={f}>{FORMATS[f].label}</option>)}
            </optgroup>
            <optgroup label="All churches compete together">
              {FORMAT_KEYS.filter((f) => FORMATS[f].kind === "race").map((f) => <option key={f} value={f}>{FORMATS[f].label}</option>)}
            </optgroup>
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
      <p className="muted hint">
        {race ? "All churches compete at once and are ranked 1st, 2nd, 3rd… " : "Two churches play each other. "}
        {rules.starters === 1
          ? `Each church picks 1 player + ${rules.maxSubs} reserve.`
          : `Team sheet: ${rules.starters} ${format === "penalties" ? "kickers" : "starters"} + up to ${rules.maxSubs} ${format === "penalties" ? "reserves" : "substitutes"}.`}
      </p>
      {kindChanged && (
        <p className="hint error" role="alert">
          This switches between a two-church match and an all-church event. It only works if the game has no fixtures yet.
        </p>
      )}
      {rulesChanged && (
        <p className="hint error" role="alert">
          Changing these resets team sheets already submitted for this game&apos;s upcoming fixtures.
        </p>
      )}

      <div className="field-label gap-top">{race ? "Points by finishing place" : "Points awarded"}</div>
      {race ? (
        <div className="field-row">
          {pointsPlaces.map((p, i) => (
            <div className="field" key={i}>
              <label className="field-label" htmlFor={`pp-${i}`}>{ordinal(i + 1)}</label>
              <input
                id={`pp-${i}`} type="number" min={0} inputMode="numeric" value={p}
                onChange={(e) => setPointsPlaces((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </div>
          ))}
        </div>
      ) : (
      <div className="field-row">
        <div className="field">
          <label className="field-label">Win</label>
          <input type="number" min={0} inputMode="numeric" value={pointsWin} onChange={(e) => setPointsWin(e.target.value)} />
        </div>
        {rules.draws && (
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
      )}
      <div className="field">
        <label className="field-label">Description (optional)</label>
        <textarea rows={2} placeholder="Rules, venue, duration…" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn accent" onClick={save}>{game ? "Save" : "Add"}</button>
      </div>
    </Modal>
  );
}
