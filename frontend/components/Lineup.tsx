import { startersLabel, subsLabel } from "@/lib/formats";
import type { Church, Game, Player, TeamSheet } from "@/lib/types";
import { ChurchChip } from "./ChurchChip";
import { Headshot } from "./PlayerCard";

/** One church's submitted line-up, read-only. */
export function Lineup({
  church, game, sheet, playerById,
}: {
  church: Church | undefined;
  game: Game | undefined;
  sheet: TeamSheet | undefined;
  playerById: Map<string, Player>;
}) {
  const format = game?.format ?? "football";
  const group = (role: "starter" | "sub") =>
    (sheet?.players ?? []).filter((p) => p.role === role).map((p) => playerById.get(p.playerId)).filter(Boolean) as Player[];
  const starters = group("starter");
  const subs = group("sub");

  return (
    <div className="lineup">
      <div className="lineup-head">{church ? <ChurchChip church={church} /> : "TBD"}</div>
      {!sheet ? (
        <p className="muted">No team sheet submitted yet.</p>
      ) : (
        <>
          <div className="field-label">{startersLabel(format)}</div>
          <ul>{starters.map((p) => <LineupRow key={p.id} player={p} />)}</ul>
          {subs.length > 0 && (
            <>
              <div className="field-label" style={{ marginTop: 10 }}>{subsLabel(format)}</div>
              <ul>{subs.map((p) => <LineupRow key={p.id} player={p} />)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

function LineupRow({ player }: { player: Player }) {
  return (
    <li>
      <Headshot player={player} size={28} />
      <span>{player.number && <span className="muted">#{player.number} </span>}{player.name}</span>
    </li>
  );
}
