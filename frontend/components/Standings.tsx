import { pointsSummary } from "@/lib/formats";
import { computeRecords } from "@/lib/utils";
import type { Church, Fixture, Game, Record3 } from "@/lib/types";
import { ChurchChip } from "./ChurchChip";

function StandingsTable({ churches, rec, showGoals }: { churches: Church[]; rec: Record<string, Record3>; showGoals: boolean }) {
  if (!churches.length) {
    return (
      <div className="empty">
        <div className="big">🏳️</div>
        <p>Add your churches in the Teams tab to see standings here.</p>
      </div>
    );
  }
  const rows = churches
    .map((c) => {
      const r = rec[c.id] ?? { w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0 };
      return { c, r, played: r.w + r.d + r.l };
    })
    .sort((a, b) => b.r.pts - a.r.pts || (b.r.gf - b.r.ga) - (a.r.gf - a.r.ga) || b.r.w - a.r.w || b.r.gf - a.r.gf);

  return (
    <div className="table-scroll">
      <table className="standings">
        <thead>
          <tr>
            <th></th><th>Church</th>
            <th className="num">P</th><th className="num">W</th><th className="num">D</th><th className="num">L</th>
            {showGoals && <><th className="num">F</th><th className="num">A</th></>}
            <th className="num pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.c.id}>
              <td className="rank">{i + 1}</td>
              <td><ChurchChip church={row.c} /></td>
              <td className="num">{row.played}</td>
              <td className="num">{row.r.w}</td>
              <td className="num">{row.r.d}</td>
              <td className="num">{row.r.l}</td>
              {showGoals && <><td className="num">{row.r.gf}</td><td className="num">{row.r.ga}</td></>}
              <td className="num pts">{row.r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Standings({ churches, games, fixtures }: { churches: Church[]; games: Game[]; fixtures: Fixture[] }) {
  return (
    <section>
      <div className="section-head"><h2>Overall Standings</h2></div>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12 }}>Points from every game added together.</p>
      <div className="card">
        <StandingsTable churches={churches} rec={computeRecords(churches, games, fixtures, null)} showGoals={false} />
      </div>
      {games.map((g) => (
        <div key={g.id} className="game-block">
          <h3>{g.name} <span className="pts-rule">{pointsSummary(g)}</span></h3>
          <div className="card">
            <StandingsTable churches={churches} rec={computeRecords(churches, games, fixtures, g.id)} showGoals />
          </div>
        </div>
      ))}
    </section>
  );
}
