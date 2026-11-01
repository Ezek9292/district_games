"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errMessage } from "@/lib/utils";
import type { Church, Fixture, Game, Player, TeamSheet } from "@/lib/types";
import { Lineup } from "../Lineup";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

/**
 * Both churches' line-ups for a fixture. Organizers load them from the API (they can see
 * sheets before kick-off); everyone else gets the public ones, published once the game is final.
 */
export function LineupsModal({
  fixture, game, churches, players, publicSheets, organizer, onClose,
}: {
  fixture: Fixture;
  game: Game | undefined;
  churches: Church[];
  players: Player[];
  publicSheets: TeamSheet[];
  organizer: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [sheets, setSheets] = useState<TeamSheet[] | null>(
    organizer ? null : publicSheets.filter((s) => s.fixtureId === fixture.id)
  );

  useEffect(() => {
    if (organizer) {
      api<TeamSheet[]>(`/api/fixtures/${fixture.id}/sheets`).then(setSheets).catch((e) => toast(errMessage(e)));
    }
  }, [organizer, fixture.id, toast]);

  const playerById = new Map(players.map((p) => [p.id, p]));
  const churchById = (id: string) => churches.find((c) => c.id === id);
  const sheetFor = (churchId: string) => sheets?.find((s) => s.churchId === churchId);

  return (
    <Modal onClose={onClose} wide>
      <h3>Line-ups — {game?.name ?? "Game"}</h3>
      <p className="muted">{fixture.round}{fixture.time && ` · ${fixture.time}`}{fixture.location && ` · ${fixture.location}`}</p>
      {!sheets ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="lineups">
          {[fixture.churchAId, fixture.churchBId].map((id) => (
            <Lineup key={id} church={churchById(id)} game={game} sheet={sheetFor(id)} playerById={playerById} />
          ))}
        </div>
      )}
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
