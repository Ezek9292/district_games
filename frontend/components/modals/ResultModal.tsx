"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { FORMATS, pointsSummary } from "@/lib/formats";
import { errMessage } from "@/lib/utils";
import type { Church, Fixture, Game } from "@/lib/types";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

/** Organizer records the final score; points are awarded from the game's rule. */
export function ResultModal({
  fixture, game, churchA, churchB, onClose,
}: {
  fixture: Fixture;
  game: Game | undefined;
  churchA: Church | undefined;
  churchB: Church | undefined;
  onClose: () => void;
}) {
  const toast = useToast();
  const [scoreA, setScoreA] = useState(fixture.scoreA?.toString() ?? "");
  const [scoreB, setScoreB] = useState(fixture.scoreB?.toString() ?? "");
  const [scoreNote, setScoreNote] = useState(fixture.scoreNote);
  const [busy, setBusy] = useState(false);

  const scoreLabel = game ? FORMATS[game.format].scoreLabel : "Score";
  const a = Number(scoreA), b = Number(scoreB);
  const filled = scoreA !== "" && scoreB !== "";
  const nameA = churchA?.name ?? "Church A", nameB = churchB?.name ?? "Church B";

  let preview = "";
  if (filled && game) {
    if (a === b) {
      preview = game.format === "football"
        ? `Draw — both get ${game.pointsDraw} pt${game.pointsDraw === 1 ? "" : "s"}`
        : `${game.name} can't end in a draw.`;
    } else {
      const [winner, loser] = a > b ? [nameA, nameB] : [nameB, nameA];
      preview = `${winner} wins: +${game.pointsWin} pts · ${loser}: +${game.pointsLoss}`;
    }
  }

  async function save(clear = false) {
    setBusy(true);
    try {
      const body = clear
        ? { scoreA: null, scoreB: null, scoreNote }
        : { scoreA: a, scoreB: b, scoreNote };
      await api(`/api/fixtures/${fixture.id}/result`, { method: "PUT", body });
      toast(clear ? "Result cleared." : "Result saved.");
      onClose();
    } catch (e) { toast(errMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose}>
      <h3>Enter Result</h3>
      <p className="muted">
        {game?.name ?? "Game"}{game && <> · {pointsSummary(game)}</>}
      </p>
      <div className="field-row">
        <div className="field">
          <label className="field-label">{nameA} — {scoreLabel}</label>
          <input type="number" min={0} inputMode="numeric" autoFocus value={scoreA} onChange={(e) => setScoreA(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">{nameB} — {scoreLabel}</label>
          <input type="number" min={0} inputMode="numeric" value={scoreB} onChange={(e) => setScoreB(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label className="field-label">Note (optional)</label>
        <input
          placeholder={game?.format === "volleyball" ? "e.g. 25–21, 22–25, 15–12" : "e.g. Won after extra time"}
          maxLength={40} value={scoreNote} onChange={(e) => setScoreNote(e.target.value)}
        />
      </div>
      {preview && <p className="result-preview">{preview}</p>}
      <div className="modal-actions">
        {fixture.status === "final" && (
          <button className="btn danger" onClick={() => save(true)} disabled={busy}>Clear result</button>
        )}
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn accent" onClick={() => save()} disabled={busy || !filled}>Save result</button>
      </div>
    </Modal>
  );
}
