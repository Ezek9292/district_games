import type { Division, Game, GameFormat, Player } from "./types";

/** Mirrors backend/src/lib/formats.ts, which enforces these limits. */
export const FORMATS: Record<GameFormat, { label: string; starters: number; maxSubs: number; scoreLabel: string }> = {
  football: { label: "Football", starters: 11, maxSubs: 5, scoreLabel: "Goals" },
  volleyball: { label: "Volleyball", starters: 6, maxSubs: 6, scoreLabel: "Sets won" },
  penalties: { label: "Penalty shoot-out", starters: 5, maxSubs: 5, scoreLabel: "Penalties scored" },
};

export const DIVISIONS: Record<Division, string> = { men: "Men", women: "Women", open: "Open" };

export function startersLabel(format: GameFormat) {
  return format === "penalties" ? "Kickers" : "Starting players";
}

export function subsLabel(format: GameFormat) {
  return format === "penalties" ? "Reserve kickers" : "Substitutes";
}

/** Why a player can't play this game, or null if they can. Same rules as the backend. */
export function ineligibleReason(game: Game, player: Player): string | null {
  if (game.division === "men" && player.gender !== "male") return "Men only";
  if (game.division === "women" && player.gender !== "female") return "Women only";
  if (game.eldersOnly && !player.isElder) return "Elders only";
  return null;
}

export function gameSummary(g: Game) {
  const f = FORMATS[g.format];
  const who = [g.division !== "open" ? DIVISIONS[g.division] : "", g.eldersOnly ? "Elders" : ""].filter(Boolean).join(", ");
  return `${f.label}${who ? ` · ${who}` : ""} · ${f.starters} + up to ${f.maxSubs} subs`;
}

export function pointsSummary(g: Game) {
  return g.format === "football"
    ? `Win ${g.pointsWin} · Draw ${g.pointsDraw} · Loss ${g.pointsLoss}`
    : `Win ${g.pointsWin} · Loss ${g.pointsLoss}`;
}
