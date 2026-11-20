"use client";

import { isRace, pointsSummary } from "@/lib/formats";
import { computeRecords, emptyRecord, isPending } from "@/lib/utils";
import { groupMembers, groupNames, isTournament, slotLabel, stageLabel } from "@/lib/tournament";
import type { Church, Fixture, Game, Record3 } from "@/lib/types";
import { useUrlParam } from "@/hooks/useUrlParam";
import { ChurchChip } from "./ChurchChip";

/** "match" shows W/D/L and goals; "race" shows podium finishes instead. */
type View = "match" | "race";

function StandingsTable({ churches, rec, view, caption }: { churches: Church[]; rec: Record<string, Record3>; view: View; caption: string }) {
  if (!churches.length) {
    return (
      <div className="empty">
        <p className="state-title">No churches yet</p>
        <p className="muted">Standings appear once the organizers add churches on the Teams tab.</p>
      </div>
    );
  }
  const rows = churches
    .map((c) => {
      const r = rec[c.id] ?? emptyRecord();
      return { c, r, played: r.w + r.d + r.l + r.ev };
    })
    .sort((a, b) => b.r.pts - a.r.pts
      || (view === "race"
        ? b.r.p1 - a.r.p1 || b.r.p2 - a.r.p2 || b.r.p3 - a.r.p3
        : (b.r.gf - b.r.ga) - (a.r.gf - a.r.ga) || b.r.w - a.r.w || b.r.gf - a.r.gf));
  const showGoals = view === "match";
  const showWdl = view === "match";
  // The leader is only marked once someone has points.
  const leaderId = rows[0]?.r.pts > 0 ? rows[0].c.id : null;

  return (
    <div className="sheet-scroll">
      <table className="sheet standings">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="rank"><span className="visually-hidden">Position</span></th>
            <th scope="col">Church</th>
            <th scope="col" className="num"><abbr title={view === "race" ? "Events" : "Played"}>P</abbr></th>
            {showWdl ? <>
              <th scope="col" className="num"><abbr title="Won">W</abbr></th>
              <th scope="col" className="num"><abbr title="Drawn">D</abbr></th>
              <th scope="col" className="num"><abbr title="Lost">L</abbr></th>
            </> : <>
              <th scope="col" className="num"><abbr title="Finished first">1st</abbr></th>
              <th scope="col" className="num"><abbr title="Finished second">2nd</abbr></th>
              <th scope="col" className="num"><abbr title="Finished third">3rd</abbr></th>
            </>}
            {showGoals && <>
              <th scope="col" className="num"><abbr title="Scored">F</abbr></th>
              <th scope="col" className="num"><abbr title="Conceded">A</abbr></th>
            </>}
            <th scope="col" className="num pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.c.id} className={row.c.id === leaderId ? "leader" : undefined}>
              <td className="rank">{i + 1}</td>
              <th scope="row"><ChurchChip church={row.c} /></th>
              <td className="num">{row.played}</td>
              {showWdl ? <>
                <td className="num">{row.r.w}</td>
                <td className="num">{row.r.d}</td>
                <td className="num">{row.r.l}</td>
              </> : <>
                <td className="num">{row.r.p1}</td>
                <td className="num">{row.r.p2}</td>
                <td className="num">{row.r.p3}</td>
              </>}
              {showGoals && <><td className="num">{row.r.gf}</td><td className="num">{row.r.ga}</td></>}
              <td className="num pts"><span>{row.r.pts}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Standings per game; each discipline has its own table, there is no combined table. */
export function Standings({ churches, games, fixtures }: { churches: Church[]; games: Game[]; fixtures: Fixture[] }) {
  const [view, setView] = useUrlParam("game", "");
  const game = games.find((g) => g.id === view) ?? games[0];

  if (!game) {
    return (
      <section aria-labelledby="standings-head">
        <div className="section-head"><h2 id="standings-head">Standings</h2></div>
        <div className="empty">
          <p className="state-title">No games yet</p>
          <p className="muted">Each game gets its own standings once the organizers add it on the Teams tab.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="standings-head">
      <div className="section-head">
        <h2 id="standings-head">{game.name}</h2>
        <p className="muted">
          {isRace(game) ? "All churches compete together. Points by place: " : ""}{pointsSummary(game)}
        </p>
      </div>

      {games.length > 1 && (
        <fieldset className="seg">
          <legend className="visually-hidden">Show standings for</legend>
          {games.map((g) => (
            <span key={g.id}>
              <input
                type="radio" name="standings-view" id={`view-${g.id}`} value={g.id}
                checked={game.id === g.id} onChange={() => setView(g.id)}
              />
              <label htmlFor={`view-${g.id}`}>{g.name}</label>
            </span>
          ))}
        </fieldset>
      )}

      {isTournament(fixtures, game.id) ? (
        <TournamentView game={game} games={games} churches={churches} fixtures={fixtures} />
      ) : (
        <StandingsTable
          churches={churches}
          rec={computeRecords(churches, games, fixtures, game.id)}
          view={isRace(game) ? "race" : "match"}
          caption={`${game.name} standings`}
        />
      )}
    </section>
  );
}

/** A tournament game: one table per group, then the semi-finals and the final. */
function TournamentView({ game, games, churches, fixtures }: { game: Game; games: Game[]; churches: Church[]; fixtures: Fixture[] }) {
  const churchById = (id: string | null) => (id ? churches.find((c) => c.id === id) : undefined);
  const knockout = fixtures
    .filter((f) => f.gameId === game.id && (f.stage === "semi" || f.stage === "final"))
    .sort((a, b) => (a.stage === "final" ? 1 : 0) - (b.stage === "final" ? 1 : 0) || (a.slot ?? 0) - (b.slot ?? 0));
  const final = knockout.find((f) => f.stage === "final");
  const champion = final && final.status === "final" && !isPending(final)
    ? churchById(final.outcome === "A" ? final.churchAId : final.outcome === "B" ? final.churchBId : null)
    : undefined;

  return (
    <>
      {champion && (
        <p className="champion"><span className="champion-label">Champions</span><ChurchChip church={champion} /></p>
      )}
      <p className="muted intro">The top 2 in each group go through. Semi-finals: winner of A v runner-up of B, and winner of B v runner-up of A.</p>
      {groupNames(fixtures, game.id).map((g) => {
        const members = groupMembers(fixtures, game.id, g)
          .map((id) => churchById(id)).filter((c): c is Church => !!c);
        const own = fixtures.filter((f) => f.gameId === game.id && f.stage === "group" && f.groupName === g);
        return (
          <div key={g} className="group-block">
            <h3 className="round-head">Group {g}</h3>
            <StandingsTable churches={members} rec={computeRecords(members, games, own, game.id)} view="match" caption={`${game.name}, group ${g}`} />
          </div>
        );
      })}
      <div className="group-block">
        <h3 className="round-head">Knockout</h3>
        <ul className="bracket">
          {knockout.map((f) => {
            const played = f.status === "final" && !isPending(f);
            return (
              <li key={f.id} className="bracket-match">
                <span className="bracket-stage">{stageLabel(f)}</span>
                {(["A", "B"] as const).map((side) => {
                  const c = churchById(side === "A" ? f.churchAId : f.churchBId);
                  const score = side === "A" ? f.scoreA : f.scoreB;
                  return (
                    <div key={side} className={"fx-side" + (played && f.outcome === side ? " won" : "")}>
                      {c ? <ChurchChip church={c} /> : <span className="muted">{slotLabel(f, side)}</span>}
                      {played && <span className="fx-score">{score}</span>}
                    </div>
                  );
                })}
                {played && f.scoreNote && <span className="muted bracket-note">{f.scoreNote}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
