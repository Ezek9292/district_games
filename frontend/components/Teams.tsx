"use client";

import { api } from "@/lib/api";
import { gameSummary, pointsSummary } from "@/lib/formats";
import { errMessage, luminanceTextColor } from "@/lib/utils";
import type { Church, Game, Player } from "@/lib/types";
import { PlayerCard } from "./PlayerCard";
import { useToast } from "./Toast";

type Props = {
  churches: Church[];
  games: Game[];
  playersByChurch: Record<string, Player[]>;
  organizerUnlocked: boolean;
  /** Rep emails by church id; only loaded for organizers. */
  churchEmails: Record<string, string | null>;
  onAddChurch: () => void;
  onEditChurch: (c: Church) => void;
  onAddGame: () => void;
  onEditGame: (g: Game) => void;
  onAddPlayer: (churchId: string) => void;
  onEditPlayer: (p: Player) => void;
};

export function Teams({ churches, games, playersByChurch, organizerUnlocked, churchEmails, ...props }: Props) {
  const toast = useToast();

  function remove(what: string, path: string) {
    if (confirm(what)) api(path, { method: "DELETE" }).catch((e) => toast(errMessage(e)));
  }

  return (
    <section>
      <div className="section-head">
        <h2>Teams</h2>
        {organizerUnlocked && <button className="btn accent" onClick={props.onAddChurch}>+ Add Church</button>}
      </div>

      <div className="team-grid">
        {!churches.length ? (
          <div className="empty" style={{ gridColumn: "1/-1" }}>
            <div className="big">⛪</div>
            <p>
              {organizerUnlocked
                ? 'Tap "+ Add Church" to register the first team.'
                : "Churches will appear here once the organizer adds them."}
            </p>
          </div>
        ) : (
          churches.map((c) => {
            const players = playersByChurch[c.id] ?? [];
            return (
              <div key={c.id} className="card team-card">
                <div className="team-head" style={{ background: c.color, color: luminanceTextColor(c.color) }}>
                  <h3>{c.name}</h3>
                  <span className="count">{players.length} players</span>
                </div>
                <div className="team-body">
                  {organizerUnlocked && (
                    <p className="pin-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                      Rep: {churchEmails[c.id] ?? <em>no email — the church can&apos;t sign in yet</em>}
                    </p>
                  )}
                  {!players.length && !organizerUnlocked && <p className="muted">No players registered yet.</p>}
                  <div className="player-grid">
                    {players.map((p) => (
                      <PlayerCard
                        key={p.id} player={p}
                        scope={organizerUnlocked ? "organizer" : undefined}
                        onEdit={() => props.onEditPlayer(p)}
                      />
                    ))}
                    {organizerUnlocked && (
                      <div className="player">
                        <button className="add-player" onClick={() => props.onAddPlayer(c.id)}>+</button>
                        <div className="pname muted">Add player</div>
                      </div>
                    )}
                  </div>
                  {organizerUnlocked && (
                    <div className="lock-row">
                      <button className="btn ghost sm" onClick={() => props.onEditChurch(c)}>Edit church</button>
                      <button
                        className="btn danger sm"
                        onClick={() => remove(`Remove ${c.name}? Its players, team sheets and fixtures will be deleted too.`, `/api/churches/${c.id}`)}
                      >
                        Remove church
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="section-head" style={{ marginTop: 34 }}>
        <h2 style={{ fontSize: 16 }}>Games</h2>
        {organizerUnlocked && <button className="btn ghost sm" onClick={props.onAddGame}>+ Add Game</button>}
      </div>
      <div className="card">
        {!games.length ? (
          <p className="muted" style={{ padding: 16, margin: 0 }}>No games added yet.</p>
        ) : (
          games.map((g) => (
            <div key={g.id} className="game-row">
              <div>
                <strong>{g.name}</strong>
                <div className="muted" style={{ fontSize: 13 }}>{gameSummary(g)}</div>
                <div className="pts-rule">{pointsSummary(g)}</div>
                {g.description && <div className="muted" style={{ fontSize: 13 }}>{g.description}</div>}
              </div>
              {organizerUnlocked && (
                <div className="fx-actions">
                  <button className="btn ghost sm" onClick={() => props.onEditGame(g)}>Edit / points</button>
                  <button
                    className="btn danger sm"
                    onClick={() => remove("Remove this game? Fixtures referencing it will be kept but orphaned.", `/api/games/${g.id}`)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
