import type { Fixture, Game } from "@prisma/client";

// Pure tournament rules for football and volleyball played as groups + knockout (no database).
// See tournament.test.ts. The frontend's lib/tournament.ts ranks groups the same way.

export const GROUPS = ["A", "B"] as const;

/** Every pairing in a group, once each: 3 churches → 3 matches, so each plays 2. */
export function roundRobin(ids: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j]]);
  }
  // Spread the matches so nobody plays twice in a row when it can be avoided (3 teams: AB, AC, BC → AB, BC, AC).
  if (pairs.length === 3) return [pairs[0], pairs[2], pairs[1]];
  return pairs;
}

type F = Pick<Fixture, "churchAId" | "churchBId" | "scoreA" | "scoreB" | "outcome" | "status" | "approvedAt" | "stage" | "groupName" | "slot">;
type G = Pick<Game, "pointsWin" | "pointsDraw" | "pointsLoss">;

const counts = (f: F) => f.status === "final" && !!f.approvedAt;

export type GroupRow = { churchId: string; played: number; w: number; d: number; l: number; gf: number; ga: number; pts: number };

/** The churches in a group, in the order they first appear in its fixtures. */
export function groupMembers(fixtures: F[], group: string): string[] {
  const ids: string[] = [];
  for (const f of fixtures) {
    if (f.stage !== "group" || f.groupName !== group) continue;
    for (const id of [f.churchAId, f.churchBId]) if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** A group's table from approved results: points, then score difference, then scored, then wins. */
export function groupTable(game: G, fixtures: F[], group: string): GroupRow[] {
  const rows = new Map<string, GroupRow>(
    groupMembers(fixtures, group).map((id) => [id, { churchId: id, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }])
  );
  for (const f of fixtures) {
    if (f.stage !== "group" || f.groupName !== group || !counts(f) || !f.churchAId || !f.churchBId) continue;
    const a = rows.get(f.churchAId), b = rows.get(f.churchBId);
    if (!a || !b) continue;
    a.played++; b.played++;
    a.gf += f.scoreA ?? 0; a.ga += f.scoreB ?? 0;
    b.gf += f.scoreB ?? 0; b.ga += f.scoreA ?? 0;
    if (f.outcome === "A") { a.w++; b.l++; a.pts += game.pointsWin; b.pts += game.pointsLoss; }
    else if (f.outcome === "B") { b.w++; a.l++; b.pts += game.pointsWin; a.pts += game.pointsLoss; }
    else { a.d++; b.d++; a.pts += game.pointsDraw; b.pts += game.pointsDraw; }
  }
  return [...rows.values()].sort((x, y) =>
    y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || y.w - x.w);
}

/** True once every match in the group has an approved result. */
export function groupComplete(fixtures: F[], group: string): boolean {
  const own = fixtures.filter((f) => f.stage === "group" && f.groupName === group);
  return own.length > 0 && own.every(counts);
}

/** The winner of a played, approved knockout match. */
function winnerOf(f: F | undefined): string | null {
  if (!f || !counts(f)) return null;
  return f.outcome === "A" ? f.churchAId : f.outcome === "B" ? f.churchBId : null;
}

/**
 * Who should be in each knockout match, as far as the results so far decide it.
 * Semi 1: winner of A vs runner-up of B. Semi 2: winner of B vs runner-up of A. Final: the two semi winners.
 */
export function knockoutPlan(game: G, fixtures: F[]) {
  const top = (group: string) => (groupComplete(fixtures, group) ? groupTable(game, fixtures, group) : []);
  const a = top("A"), b = top("B");
  const semi = (slot: number) => fixtures.find((f) => f.stage === "semi" && f.slot === slot);
  return {
    semi1: [a[0]?.churchId ?? null, b[1]?.churchId ?? null] as const,
    semi2: [b[0]?.churchId ?? null, a[1]?.churchId ?? null] as const,
    final: [winnerOf(semi(1)), winnerOf(semi(2))] as const,
  };
}
