import type { Fixture } from "./types";

// Football and volleyball as a tournament: groups A and B, then semi-finals and a final.
// The server fills the knockout matches (see backend/src/lib/tournament.ts); this only reads them.

export const STAGE_ORDER: Record<string, number> = { group: 0, semi: 1, final: 2 };

/** True when the game's fixtures were set up as a tournament. */
export const isTournament = (fixtures: Fixture[], gameId: string) =>
  fixtures.some((f) => f.gameId === gameId && f.stage === "group");

export const isKnockout = (f: Fixture) => f.stage === "semi" || f.stage === "final";

/** The group names used by a game's fixtures, in order ("A", "B"). */
export function groupNames(fixtures: Fixture[], gameId: string): string[] {
  const names = new Set<string>();
  fixtures.forEach((f) => { if (f.gameId === gameId && f.stage === "group" && f.groupName) names.add(f.groupName); });
  return [...names].sort();
}

/** The churches in a group, in the order they first appear in its fixtures. */
export function groupMembers(fixtures: Fixture[], gameId: string, group: string): string[] {
  const ids: string[] = [];
  for (const f of fixtures) {
    if (f.gameId !== gameId || f.stage !== "group" || f.groupName !== group) continue;
    for (const id of [f.churchAId, f.churchBId]) if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** What goes in an empty knockout slot, e.g. "Winner of Group A". */
export function slotLabel(f: Fixture, side: "A" | "B"): string {
  if (f.stage === "semi") {
    if (f.slot === 1) return side === "A" ? "Winner of Group A" : "Runner-up of Group B";
    if (f.slot === 2) return side === "A" ? "Winner of Group B" : "Runner-up of Group A";
  }
  if (f.stage === "final") return side === "A" ? "Winner of semi-final 1" : "Winner of semi-final 2";
  return "To be decided";
}

/** "Semi-final 1", "Final", "Group A", or the organizer's own round label. */
export function stageLabel(f: Fixture): string {
  if (f.stage === "semi") return `Semi-final ${f.slot ?? ""}`.trim();
  if (f.stage === "final") return "Final";
  if (f.stage === "group" && f.groupName) return `Group ${f.groupName}`;
  return f.round;
}
