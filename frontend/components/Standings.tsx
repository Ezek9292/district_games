"use client";

import { pointsSummary } from "@/lib/formats";
import { computeRecords } from "@/lib/utils";
import type { Church, Fixture, Game, Record3 } from "@/lib/types";
import { useUrlParam } from "@/hooks/useUrlParam";
import { ChurchChip } from "./ChurchChip";

const OVERALL = "overall";

function StandingsTable({ churches, rec, showGoals, caption }: { churches: Church[]; rec: Record<string, Record3>; showGoals: boolean; caption: string }) {
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
      const r = rec[c.id] ?? { w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0 };
      return { c, r, played: r.w + r.d + r.l };
    })
    .sort((a, b) => b.r.pts - a.r.pts || (b.r.gf - b.r.ga) - (a.r.gf - a.r.ga) || b.r.w - a.r.w || b.r.gf - a.r.gf);
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
            <th scope="col" className="num"><abbr title="Played">P</abbr></th>
            <th scope="col" className="num"><abbr title="Won">W</abbr></th>
            <th scope="col" className="num"><abbr title="Drawn">D</abbr></th>
            <th scope="col" className="num"><abbr title="Lost">L</abbr></th>
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
              <td className="num">{row.r.w}</td>
              <td className="num">{row.r.d}</td>
              <td className="num">{row.r.l}</td>
              {showGoals && <><td className="num">{row.r.gf}</td><td className="num">{row.r.ga}</td></>}
              <td className="num pts"><span>{row.r.pts}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Standings({ churches, games, fixtures }: { churches: Church[]; games: Game[]; fixtures: Fixture[] }) {
  const [view, setView] = useUrlParam("game", OVERALL);
  const game = games.find((g) => g.id === view);
  const current = game ? game.id : OVERALL;

  return (
    <section aria-labelledby="standings-head">
      <div className="section-head">
        <h2 id="standings-head">{game ? game.name : "Overall Standings"}</h2>
        <p className="muted">{game ? pointsSummary(game) : "Points from every game added together."}</p>
      </div>

      {games.length > 0 && (
        <fieldset className="seg">
          <legend className="visually-hidden">Show standings for</legend>
          {[{ id: OVERALL, name: "Overall" }, ...games].map((g) => (
            <span key={g.id}>
              <input
                type="radio" name="standings-view" id={`view-${g.id}`} value={g.id}
                checked={current === g.id} onChange={() => setView(g.id)}
              />
              <label htmlFor={`view-${g.id}`}>{g.name}</label>
            </span>
          ))}
        </fieldset>
      )}

      <StandingsTable
        churches={churches}
        rec={computeRecords(churches, games, fixtures, game ? game.id : null)}
        showGoals={!!game}
        caption={game ? `${game.name} standings` : "Overall standings"}
      />
    </section>
  );
}
