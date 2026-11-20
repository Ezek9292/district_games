"use client";

import { api } from "@/lib/api";
import { isRace, ordinal, placePoints } from "@/lib/formats";
import { errMessage, isPending } from "@/lib/utils";
import { STAGE_ORDER, slotLabel, stageLabel } from "@/lib/tournament";
import type { Church, Fixture, Game } from "@/lib/types";
import { ChurchChip } from "./ChurchChip";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

type Props = {
  churches: Church[];
  games: Game[];
  fixtures: Fixture[];
  organizerUnlocked: boolean;
  /** A super organizer approves or rejects results other organizers entered. */
  isSuper: boolean;
  onAdd: () => void;
  onEdit: (f: Fixture) => void;
  onResult: (f: Fixture) => void;
  onLineups: (f: Fixture) => void;
};

export function Schedule({ churches, games, fixtures, organizerUnlocked, isSuper, onAdd, onEdit, onResult, onLineups }: Props) {
  const toast = useToast();
  const churchById = (id: string) => churches.find((c) => c.id === id);
  const gameOf = (id: string | null) => games.find((g) => g.id === id);
  const gameName = (id: string | null) => gameOf(id)?.name ?? "No game set";

  function remove(fid: string) {
    if (confirm("Remove this fixture?")) api(`/api/fixtures/${fid}`, { method: "DELETE" }).catch((e) => toast(errMessage(e)));
  }

  async function decide(f: Fixture, approve: boolean) {
    if (!approve && !confirm("Reject this result? It will be cleared so it can be entered again.")) return;
    try {
      await api(`/api/fixtures/${f.id}/${approve ? "approve" : "reject"}`, { method: "PUT" });
      toast(approve ? "Result approved. It now counts in the standings." : "Result rejected and cleared.");
    } catch (e) { toast(errMessage(e)); }
  }

  /** "Awaiting approval" note, plus Approve / Reject for a super organizer. */
  const approval = (f: Fixture) => isPending(f) && (
    <div className="approval">
      <p className="pending-note">
        <Icon name="alert" size={16} />
        Awaiting approval{f.enteredBy && <span className="muted"> · entered by {f.enteredBy}</span>}
      </p>
      {isSuper && (
        <div className="approval-actions">
          <button type="button" className="btn sm accent" onClick={() => decide(f, true)}>Approve</button>
          <button type="button" className="btn ghost sm danger" onClick={() => decide(f, false)}>Reject</button>
        </div>
      )}
    </div>
  );

  const groups: Record<string, Fixture[]> = {};
  // Tournament fixtures are grouped by game and stage ("Men's Soccer: Group A"); others by their round label.
  const keyOf = (f: Fixture) => (f.stage ? `${gameName(f.gameId)}: ${stageLabel(f).replace(/ \d+$/, "s")}` : f.round || "Unscheduled");
  const rank = (f: Fixture) => (f.stage ? 1 + STAGE_ORDER[f.stage] : 0);
  fixtures.forEach((f) => { (groups[keyOf(f)] ??= []).push(f); });
  const order = Object.keys(groups).sort((a, b) =>
    rank(groups[a][0]) - rank(groups[b][0]) || a.localeCompare(b));

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
                const game = gameOf(f.gameId);
                const isFinal = f.status === "final";
                if (isRace(game) || f.entries?.length) {
                  return (
                    <EventCard
                      key={f.id} fixture={f} gameName={gameName(f.gameId)} churchById={churchById} approval={approval(f)}
                      points={(place) => placePoints(game, place)}
                      actions={
                        <div className="fx-actions">
                          {(organizerUnlocked || isFinal) && (
                            <button type="button" className="btn ghost sm" onClick={() => onLineups(f)}>Competitors</button>
                          )}
                          {organizerUnlocked && (
                            <>
                              <button type="button" className="btn sm" onClick={() => onResult(f)}>{isFinal ? "Edit places" : "Enter places"}</button>
                              <button type="button" className="btn ghost sm" onClick={() => onEdit(f)}>Edit</button>
                              <button type="button" className="btn ghost sm icon-only danger" aria-label="Remove event" onClick={() => remove(f.id)}>
                                <Icon name="close" />
                              </button>
                            </>
                          )}
                        </div>
                      }
                    />
                  );
                }
                const ca = f.churchAId ? churchById(f.churchAId) : undefined;
                const cb = f.churchBId ? churchById(f.churchBId) : undefined;
                const hasScore = isFinal && f.scoreA !== null;
                const won = (side: "A" | "B") => hasScore && f.outcome === side;
                return (
                  <li key={f.id} className={"fixture" + (hasScore ? " is-final" : "") + (isPending(f) ? " is-pending" : "")}>
                    <div className="fx-when">
                      <span className="fx-time">{f.time || "Time to be set"}</span>
                      <span className="fx-game">{gameName(f.gameId)}</span>
                      {f.location && <span className="muted">{f.location}</span>}
                    </div>
                    <div className="fx-teams">
                      <div className={"fx-side" + (won("A") ? " won" : "")}>
                        {ca ? <ChurchChip church={ca} /> : <span className="muted">{slotLabel(f, "A")}</span>}
                        {hasScore && <span className="fx-score">{f.scoreA}</span>}
                      </div>
                      <div className={"fx-side" + (won("B") ? " won" : "")}>
                        {cb ? <ChurchChip church={cb} /> : <span className="muted">{slotLabel(f, "B")}</span>}
                        {hasScore && <span className="fx-score">{f.scoreB}</span>}
                      </div>
                      {isPending(f) ? approval(f) : (
                        <p className="fx-status">
                          {isFinal ? "Final" : "Scheduled"}
                          {f.scoreNote && <span className="muted"> ({f.scoreNote})</span>}
                        </p>
                      )}
                    </div>
                    <div className="fx-actions">
                      {(organizerUnlocked || isFinal) && (
                        <button type="button" className="btn ghost sm" onClick={() => onLineups(f)}>Line-ups</button>
                      )}
                      {organizerUnlocked && (
                        <>
                          {ca && cb && (
                            <button type="button" className="btn sm" onClick={() => onResult(f)}>{isFinal ? "Edit result" : "Enter result"}</button>
                          )}
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

/** An all-church event: every entered church, ranked by place once the result is in. */
function EventCard({
  fixture: f, gameName, churchById, points, actions, approval,
}: {
  fixture: Fixture;
  approval: React.ReactNode;
  gameName: string;
  churchById: (id: string) => Church | undefined;
  points: (place: number | null) => number;
  actions: React.ReactNode;
}) {
  const isFinal = f.status === "final";
  const entries = [...(f.entries ?? [])];
  if (isFinal) entries.sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity));
  return (
    <li className={"fixture event-fx" + (isFinal ? " is-final" : "") + (isPending(f) ? " is-pending" : "")}>
      <div className="fx-when">
        <span className="fx-time">{f.time || "Time to be set"}</span>
        <span className="fx-game">{gameName}</span>
        {f.location && <span className="muted">{f.location}</span>}
      </div>
      <div className="fx-teams">
        <ol className="fx-entries">
          {entries.map((e) => {
            const c = churchById(e.churchId);
            return (
              <li key={e.churchId} className={"fx-side" + (isFinal && e.place === 1 ? " won" : "")}>
                {isFinal && <span className={"place-badge" + (e.place && e.place <= 3 ? ` p${e.place}` : "")}>{e.place ? ordinal(e.place) : "DNF"}</span>}
                {c ? <ChurchChip church={c} /> : <span className="muted">Removed church</span>}
                {isFinal && <span className="fx-score">{points(e.place)} {points(e.place) === 1 ? "pt" : "pts"}</span>}
              </li>
            );
          })}
        </ol>
        {approval || (
          <p className="fx-status">
            {isFinal ? "Final" : `All churches together: ${entries.length} entered`}
            {f.scoreNote && <span className="muted"> ({f.scoreNote})</span>}
          </p>
        )}
      </div>
      {actions}
    </li>
  );
}
