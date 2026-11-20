import type { GameFormat } from "@prisma/client";

/**
 * How each sport is played.
 * - kind "match": two churches meet (church A vs church B) and the score decides win/draw/loss.
 * - kind "race": every entered church competes at once and is ranked 1st, 2nd, 3rd...
 *
 * Team-sheet sizes:
 * - Football: 11 starters, 5 substitutes (the 5 changes allowed under IFAB rules).
 * - Volleyball: 6 starters, 6 substitutes (FIVB 12-player match roster).
 * - Penalty shoot-out: 5 kickers, 5 reserves for sudden death (10 per church).
 * - Table tennis, draughts and the all-church events: 1 player per church, plus 1 reserve.
 */
export const FORMATS: Record<GameFormat, { label: string; kind: "match" | "race"; draws: boolean; starters: number; maxSubs: number }> = {
  football: { label: "Football", kind: "match", draws: true, starters: 11, maxSubs: 5 },
  volleyball: { label: "Volleyball", kind: "match", draws: false, starters: 6, maxSubs: 6 },
  penalties: { label: "Penalty shoot-out", kind: "match", draws: false, starters: 5, maxSubs: 5 },
  tableTennis: { label: "Table tennis", kind: "match", draws: false, starters: 1, maxSubs: 1 },
  draughts: { label: "Draughts", kind: "match", draws: true, starters: 1, maxSubs: 1 },
  sprint: { label: "100 metres", kind: "race", draws: false, starters: 1, maxSubs: 1 },
  sackRace: { label: "Sack race", kind: "race", draws: false, starters: 1, maxSubs: 1 },
  limeSpoon: { label: "Lime and spoon", kind: "race", draws: false, starters: 1, maxSubs: 1 },
  ludo: { label: "Ludo", kind: "race", draws: false, starters: 1, maxSubs: 1 },
};

export const FORMAT_KEYS = Object.keys(FORMATS) as [GameFormat, ...GameFormat[]];

export const isRace = (format: GameFormat) => FORMATS[format].kind === "race";
