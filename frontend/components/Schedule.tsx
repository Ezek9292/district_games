"use client";

import { api } from "@/lib/api";
import { errMessage } from "@/lib/utils";
import type { Church, Fixture, Game } from "@/lib/types";
import { ChurchChip } from "./ChurchChip";
import { Icon } from "./Icon";
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
  const gameName = (id: string | null) => games.find((g) => g.id === id)?.name ?? "No game set";

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
    <section aria-labelledby="schedule-head">
      <div className="section-head">
        <h2 id="schedule-head">Schedule</h2>
        {organizerUnlocked && (
          <button type="button" className="btn accent" onClick={onAdd}><Icon name="plus" />Add fixture</button>
        )}
      </div>

      {!fixtures.length ? (
        <div className="empty">
          <p className="state-title">No fixtures yet</p>
          <p className="muted">
            {organizerUnlocked
              ? "Add the first fixture to build the schedule. Churches and games must exist first."
              : "Check back once the organizers set the schedule."}
          </p>
        </div>
      ) : (
        order.map((key) => (
          <div key={key} className="round">
            <h3 className="round-head">{key}</h3>
            <ul className="fixtures">
              {groups[key].map((f) => {
                const ca = churchById(f.churchAId);
                const cb = churchById(f.churchBId);
                const isFinal = f.status === "final";
                const hasScore = isFinal && f.scoreA !== null;
                const won = (side: "A" | "B") => hasScore && f.outcome === side;
                return (
                  <li key={f.id} className={"fixture" + (hasScore ? " is-final" : "")}>
                    <div className="fx-when">
                      <span className="fx-time">{f.time || "Time to be set"}</span>
                      <span className="fx-game">{gameName(f.gameId)}</span>
                      {f.location && <span className="muted">{f.location}</span>}
                    </div>
                    <div className="fx-teams">
                      <div className={"fx-side" + (won("A") ? " won" : "")}>
                        {ca ? <ChurchChip church={ca} /> : <span className="muted">To be decided</span>}
                        {hasScore && <span className="fx-score">{f.scoreA}</span>}
                      </div>
                      <div className={"fx-side" + (won("B") ? " won" : "")}>
                        {cb ? <ChurchChip church={cb} /> : <span className="muted">To be decided</span>}
                        {hasScore && <span className="fx-score">{f.scoreB}</span>}
                      </div>
                      <p className="fx-status">
                        {isFinal ? "Final" : "Scheduled"}
                        {f.scoreNote && <span className="muted"> ({f.scoreNote})</span>}
                      </p>
                    </div>
                    <div className="fx-actions">
                      {(organizerUnlocked || isFinal) && (
                        <button type="button" className="btn ghost sm" onClick={() => onLineups(f)}>Line-ups</button>
                      )}
                      {organizerUnlocked && (
                        <>
                          <button type="button" className="btn sm" onClick={() => onResult(f)}>{isFinal ? "Edit result" : "Enter result"}</button>
                          <button type="button" className="btn ghost sm" onClick={() => onEdit(f)}>Edit</button>
                          <button type="button" className="btn ghost sm icon-only danger" aria-label="Remove fixture" onClick={() => remove(f.id)}>
                            <Icon name="close" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
