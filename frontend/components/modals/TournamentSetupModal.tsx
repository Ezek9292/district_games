"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { groupMembers } from "@/lib/tournament";
import { errMessage } from "@/lib/utils";
import type { Church, Fixture, Game } from "@/lib/types";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

type Pick = "A" | "B" | "";

/**
 * Organizer puts each church in Group A or B (or leaves it out). Saving creates the group matches
 * (everyone in a group plays everyone else once), two semi-finals and a final.
 */
export function TournamentSetupModal({
  game, churches, fixtures, onDone, onClose,
}: {
  game: Game;
  churches: Church[];
  /** This game's current fixtures. */
  fixtures: Fixture[];
  onDone: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [picks, setPicks] = useState<Record<string, Pick>>(() => {
    // Start from the current groups, or split the churches in half: first half A, second half B.
    const a = groupMembers(fixtures, game.id, "A"), b = groupMembers(fixtures, game.id, "B");
    if (a.length || b.length) return Object.fromEntries(churches.map((c) => [c.id, a.includes(c.id) ? "A" : b.includes(c.id) ? "B" : ""]));
    const half = Math.ceil(churches.length / 2);
    return Object.fromEntries(churches.map((c, i) => [c.id, i < half ? "A" : "B"]));
  });
  const [busy, setBusy] = useState(false);

  const groupA = churches.filter((c) => picks[c.id] === "A").map((c) => c.id);
  const groupB = churches.filter((c) => picks[c.id] === "B").map((c) => c.id);
  const matches = (n: number) => (n * (n - 1)) / 2;
  const hasResults = fixtures.some((f) => f.status === "final");
  const ready = groupA.length >= 2 && groupB.length >= 2 && !hasResults;

  async function save() {
    if (fixtures.length && !confirm(`This replaces the ${fixtures.length} fixture${fixtures.length === 1 ? "" : "s"} already set for ${game.name}. Continue?`)) return;
    setBusy(true);
    try {
      await api(`/api/games/${game.id}/tournament`, { method: "POST", body: { groupA, groupB } });
      toast(`${game.name} tournament set up. Add times and venues from the Schedule.`);
      onDone();
    } catch (e) { toast(errMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose}>
      <h3>Tournament: {game.name}</h3>
      <p className="muted">
        Put each church in a group. Everyone in a group plays each other once, the top 2 go through,
        then winner of A v runner-up of B and winner of B v runner-up of A in the semi-finals, and the winners meet in the final.
      </p>
      {hasResults && (
        <p className="hint error" role="alert">{game.name} already has results. Clear them on the Schedule before setting it up again.</p>
      )}
      <ul className="group-picks">
        {churches.map((c) => (
          <li key={c.id} className="group-pick">
            <span className="church-chip">
              <span className="swatch" style={{ background: c.color }} aria-hidden="true" />
              <span>{c.name}</span>
            </span>
            <span className="seg-mini" role="group" aria-label={`Group for ${c.name}`}>
              {(["A", "B", ""] as Pick[]).map((g) => (
                <button
                  key={g || "out"} type="button" className="btn sm ghost" aria-pressed={picks[c.id] === g}
                  onClick={() => setPicks((p) => ({ ...p, [c.id]: g }))}
                >
                  {g ? `Group ${g}` : "Out"}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="group-counts">
        <span>Group A: <strong>{groupA.length}</strong> churches, {matches(groupA.length)} matches</span>
        <span>Group B: <strong>{groupB.length}</strong> churches, {matches(groupB.length)} matches</span>
      </p>
      {!hasResults && (groupA.length < 2 || groupB.length < 2) && (
        <p className="hint error">Each group needs at least 2 churches.</p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn accent" onClick={save} disabled={busy || !ready}>Create fixtures</button>
      </div>
    </Modal>
  );
}
