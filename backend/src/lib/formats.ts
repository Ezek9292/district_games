import type { GameFormat } from "@prisma/client";

/**
 * Team-sheet sizes per game format.
 * - Football: 11 starters, 5 substitutes (the 5 changes allowed under IFAB rules).
 * - Volleyball: 6 starters, 6 substitutes (FIVB 12-player match roster).
 * - Penalty shoot-out: 5 kickers, 5 reserves for sudden death (10 per church).
 */
export const FORMATS: Record<GameFormat, { label: string; starters: number; maxSubs: number }> = {
  football: { label: "Football", starters: 11, maxSubs: 5 },
  volleyball: { label: "Volleyball", starters: 6, maxSubs: 6 },
  penalties: { label: "Penalty shoot-out", starters: 5, maxSubs: 5 },
};
