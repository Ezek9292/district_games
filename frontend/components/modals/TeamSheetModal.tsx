"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { FORMATS, ineligibleReason, startersLabel, subsLabel } from "@/lib/formats";
import { errMessage } from "@/lib/utils";
import type { Church, Fixture, Game, Player, SheetRole, TeamSheet } from "@/lib/types";
import { Modal } from "../Modal";
import { Headshot } from "../PlayerCard";
import { useToast } from "../Toast";

/** A church picks its starters and substitutes for one fixture from its registered players. */
export function TeamSheetModal({
  fixture, game, opponent, players, sheet, onClose,
}: {
  fixture: Fixture;
  game: Game;
  opponent: Church | undefined;
  players: Player[];
  sheet: TeamSheet | undefined;
  onClose: () => void;
}) {
  const toast = useToast();
  const rules = FORMATS[game.format];
  const [picks, setPicks] = useState<Record<string, SheetRole>>(() =>
    Object.fromEntries((sheet?.players ?? []).map((p) => [p.playerId, p.role]))
  );
  const [busy, setBusy] = useState(false);

  // Keep the order players were picked in, starting from the saved sheet's order.
  const [order, setOrder] = useState<string[]>(() => (sheet?.players ?? []).map((p) => p.playerId));
  const starters = order.filter((id) => picks[id] === "starter");
  const subs = order.filter((id) => picks[id] === "sub");

  const eligible = players.filter((p) => !ineligibleReason(game, p));
  const ineligibleCount = players.length - eligible.length;

  function toggle(id: string, role: SheetRole) {
    if (picks[id] === role) {
      setPicks(({ [id]: _, ...rest }) => rest);
      setOrder((o) => o.filter((x) => x !== id));
      return;
    }
    if (role === "starter" && starters.length >= rules.starters) {
      toast(`You already have ${rules.starters} ${startersLabel(game.format).toLowerCase()}.`); return;
    }
    if (role === "sub" && subs.length >= rules.maxSubs) {
      toast(`Only ${rules.maxSubs} ${subsLabel(game.format).toLowerCase()} are allowed.`); return;
    }
    setPicks((p) => ({ ...p, [id]: role }));
    setOrder((o) => [...o.filter((x) => x !== id), id]);
  }

  async function save() {
    setBusy(true);
    try {
      await api(`/api/church/fixtures/${fixture.id}/sheet`, { method: "PUT", body: { starters, subs } });
      toast("Team sheet saved.");
      onClose();
    } catch (e) { toast(errMessage(e)); }
    finally { setBusy(false); }
  }

  const complete = starters.length === rules.starters;

  return (
    <Modal onClose={onClose} wide>
      <h3>Team Sheet — {game.name}</h3>
      <p className="muted">
        vs {opponent?.name ?? "TBD"}{fixture.time && ` · ${fixture.time}`}{fixture.location && ` · ${fixture.location}`}
      </p>
      <div className="sheet-counts">
        <span className={complete ? "ok" : ""}>
          {startersLabel(game.format)}: <strong>{starters.length}/{rules.starters}</strong>
        </span>
        <span>
          {subsLabel(game.format)}: <strong>{subs.length}/{rules.maxSubs}</strong>
        </span>
      </div>

      {!eligible.length ? (
        <div className="empty">
          <p>
            None of your registered players can play this game
            {game.eldersOnly ? " — register players as elders first." : ` — it's for ${game.division} only.`}
          </p>
        </div>
      ) : (
        <div className="pick-list">
          {eligible.map((p) => (
            <div key={p.id} className={"pick-row" + (picks[p.id] ? " picked" : "")}>
              <Headshot player={p} size={36} />
              <span className="pick-name">
                {p.name}
                {p.number && <span className="muted"> #{p.number}</span>}
              </span>
              <button className={"scorebtn" + (picks[p.id] === "starter" ? " active" : "")} onClick={() => toggle(p.id, "starter")}>
                {game.format === "penalties" ? "Kicker" : "Start"}
              </button>
              <button className={"scorebtn" + (picks[p.id] === "sub" ? " active" : "")} onClick={() => toggle(p.id, "sub")}>
                {game.format === "penalties" ? "Reserve" : "Sub"}
              </button>
            </div>
          ))}
        </div>
      )}
      {ineligibleCount > 0 && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          {ineligibleCount} of your players {ineligibleCount === 1 ? "isn't" : "aren't"} eligible for this game and {ineligibleCount === 1 ? "is" : "are"} hidden.
        </p>
      )}

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn accent" onClick={save} disabled={busy || !complete}>
          {complete ? "Save team sheet" : `Pick ${rules.starters - starters.length} more`}
        </button>
      </div>
    </Modal>
  );
}
