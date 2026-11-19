"use client";

import { api } from "@/lib/api";
import { gameSummary, pointsSummary } from "@/lib/formats";
import { errMessage } from "@/lib/utils";
import type { Church, ChurchRepEmail, Game, Player } from "@/lib/types";
import { useUrlParam } from "@/hooks/useUrlParam";
import { Icon } from "./Icon";
import { PlayerCard } from "./PlayerCard";
import { useToast } from "./Toast";

type Props = {
  churches: Church[];
  games: Game[];
  playersByChurch: Record<string, Player[]>;
  organizerUnlocked: boolean;
  /** Rep emails by church id; only loaded for organizers. */
  churchEmails: Record<string, ChurchRepEmail[]>;
  onAddChurch: () => void;
  onEditChurch: (c: Church) => void;
  onAddGame: () => void;
  onEditGame: (g: Game) => void;
  onAddPlayer: (churchId: string) => void;
  onEditPlayer: (p: Player) => void;
};

export function Teams({ churches, games, playersByChurch, organizerUnlocked, churchEmails, ...props }: Props) {
  const toast = useToast();
  // One church at a time, picked from a row of buttons, so no one scrolls past a whole roster
  // to reach the next church. The choice stays in the URL; the first church is the default.
  const [churchParam, setChurchParam] = useUrlParam("church", "");
  const selected = churches.find((c) => c.id === churchParam) ?? churches[0];

  function remove(what: string, path: string) {
    if (confirm(what)) api(path, { method: "DELETE" }).catch((e) => toast(errMessage(e)));
  }

  return (
    <section aria-labelledby="teams-head">
      <div className="section-head">
        <h2 id="teams-head">Teams</h2>
        {organizerUnlocked && (
          <button type="button" className="btn accent" onClick={props.onAddChurch}><Icon name="plus" />Add church</button>
        )}
      </div>

      {!churches.length ? (
        <div className="empty">
          <p className="state-title">No churches yet</p>
          <p className="muted">
            {organizerUnlocked
              ? "Add the first church to register its team."
              : "Churches will appear here once the organizers add them."}
          </p>
        </div>
      ) : (
        <>
        {churches.length > 1 && (
          <fieldset className="seg">
            <legend className="visually-hidden">Show the team of</legend>
            {churches.map((c) => (
              <span key={c.id}>
                <input
                  type="radio" name="team-view" id={`church-${c.id}`} value={c.id}
                  checked={selected?.id === c.id} onChange={() => setChurchParam(c.id)}
                />
                <label htmlFor={`church-${c.id}`}>
                  <span className="swatch" style={{ background: c.color }} aria-hidden="true" />
                  {c.name}
                  <span className="seg-count">{(playersByChurch[c.id] ?? []).length}</span>
                </label>
              </span>
            ))}
          </fieldset>
        )}
        {churches.filter((c) => c.id === selected?.id).map((c) => {
          const players = playersByChurch[c.id] ?? [];
          const reps = churchEmails[c.id] ?? [];
          return (
            <article key={c.id} className="team" aria-labelledby={`team-${c.id}`}>
              <header className="team-head">
                <span className="swatch lg" style={{ background: c.color }} aria-hidden="true" />
                <h3 id={`team-${c.id}`}>{c.name}</h3>
                <span className="count">{players.length} {players.length === 1 ? "player" : "players"}</span>
                {organizerUnlocked && (
                  <div className="team-actions">
                    <button type="button" className="btn ghost sm" onClick={() => props.onEditChurch(c)}>Edit church</button>
                    <button
                      type="button" className="btn ghost sm danger"
                      onClick={() => remove(`Remove ${c.name}? Its players, team sheets and fixtures will be deleted too.`, `/api/churches/${c.id}`)}
                    >
                      Remove church
                    </button>
                  </div>
                )}
              </header>
              {organizerUnlocked && (
                <p className={"reps" + (reps.length ? "" : " warn")}>
                  {reps.length
                    ? <>Reps: {reps.map((e) => e.email).join(", ")}</>
                    : <>No rep email yet, so this church can&apos;t sign in. Add one under Edit church.</>}
                </p>
              )}
              {!players.length && !organizerUnlocked ? (
                <p className="muted">No players registered yet.</p>
              ) : (
                <ul className="player-grid">
                  {players.map((p) => (
                    <li key={p.id}>
                      <PlayerCard
                        player={p} church={c}
                        scope={organizerUnlocked ? "organizer" : undefined}
                        onEdit={organizerUnlocked ? () => props.onEditPlayer(p) : undefined}
                      />
                    </li>
                  ))}
                  {organizerUnlocked && (
                    <li>
                      <button type="button" className="add-player" onClick={() => props.onAddPlayer(c.id)}>
                        <Icon name="plus" size={22} />
                        <span>Add player</span>
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </article>
          );
        })}
        </>
      )}

      <div className="section-head sub">
        <h2>Games</h2>
        {organizerUnlocked && <button type="button" className="btn sm" onClick={props.onAddGame}><Icon name="plus" />Add game</button>}
      </div>
      {!games.length ? (
        <p className="muted">No games added yet.</p>
      ) : (
        <ul className="games">
          {games.map((g) => (
            <li key={g.id} className="game-row">
              <div className="game-info">
                <strong>{g.name}</strong>
                <span className="muted">{gameSummary(g)}</span>
                <span className="pts-rule">{pointsSummary(g)}</span>
                {g.description && <span className="muted">{g.description}</span>}
              </div>
              {organizerUnlocked && (
                <div className="fx-actions">
                  <button type="button" className="btn ghost sm" onClick={() => props.onEditGame(g)}>Edit / points</button>
                  <button
                    type="button" className="btn ghost sm danger"
                    onClick={() => remove("Remove this game? Fixtures referencing it will be kept but orphaned.", `/api/games/${g.id}`)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
