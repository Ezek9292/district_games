"use client";

import { api } from "@/lib/api";
import { errMessage } from "@/lib/utils";
import type { Church, Fixture, Game } from "@/lib/types";
import { ChurchChip } from "./ChurchChip";
import { useToast } from "./Toast";

type Props = {
  churches: Church[];
  games: Game[];
  fixtures: Fixture[];
  organizerUnlocked: boolean;
  onAdd: () => void;
  onEdit: (f: Fixture) => void;
  onResult: (f: Fixture) => void;
  onLineups: (f: Fixture) => void;
};

export function Schedule({ churches, games, fixtures, organizerUnlocked, onAdd, onEdit, onResult, onLineups }: Props) {
  const toast = useToast();
  const churchById = (id: string) => churches.find((c) => c.id === id);
  const gameName = (id: string | null) => games.find((g) => g.id === id)?.name ?? "—";

  function remove(fid: string) {
    if (confirm("Remove this fixture?")) api(`/api/fixtures/${fid}`, { method: "DELETE" }).catch((e) => toast(errMessage(e)));
  }

  const groups: Record<string, Fixture[]> = {};
  fixtures.forEach((f) => {
    const key = f.round || "Unscheduled";
    (groups[key] ??= []).push(f);
  });
  const order = Object.keys(groups).sort();

  return (
    <section>
      <div className="section-head">
        <h2>Schedule</h2>
        {organizerUnlocked && <button className="btn accent" onClick={onAdd}>+ Add Fixture</button>}
      </div>

      {!fixtures.length ? (
        <div className="empty">
          <div className="big">📋</div>
          <p>
            No fixtures yet.
            {organizerUnlocked
              ? ' Tap "+ Add Fixture" to build the schedule.'
              : " Check back once the organizer sets the schedule."}
          </p>
        </div>
      ) : (
        order.map((key) => (
          <div key={key}>
            <div className="round-label">{key}</div>
            <div className="card">
              {groups[key].map((f) => {
                const ca = churchById(f.churchAId);
                const cb = churchById(f.churchBId);
                const isFinal = f.status === "final";
                return (
                  <div key={f.id} className="fixture">
                    <div className="fx-teams">
                      {ca ? <ChurchChip church={ca} /> : <span className="muted">TBD</span>}
                      {isFinal && f.scoreA !== null
                        ? <span className="fx-score">{f.scoreA} – {f.scoreB}</span>
                        : <span className="fx-vs">vs</span>}
                      {cb ? <ChurchChip church={cb} /> : <span className="muted">TBD</span>}
                    </div>
                    <div className="fx-meta">
                      <span className="fx-game">{gameName(f.gameId)}</span>
                      <br />
                      {f.time || ""}
                      {f.location ? " · " + f.location : ""}
                    </div>
                    <span className={"fx-status " + (isFinal ? "final" : "scheduled")}>
                      {isFinal ? "Final" : "Scheduled"}
                    </span>
                    {f.scoreNote && <span className="muted">({f.scoreNote})</span>}
                    <div className="fx-actions">
                      {(organizerUnlocked || isFinal) && (
                        <button className="btn ghost sm" onClick={() => onLineups(f)}>Line-ups</button>
                      )}
                      {organizerUnlocked && (
                        <>
                          <button className="btn accent sm" onClick={() => onResult(f)}>{isFinal ? "Edit result" : "Enter result"}</button>
                          <button className="btn ghost sm" onClick={() => onEdit(f)}>Edit</button>
                          <button className="btn danger sm" onClick={() => remove(f.id)}>×</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
