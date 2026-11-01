import type { Church, Fixture, Game, Record3 } from "./types";

export const DEFAULT_EVENT_NAME = "Taifa District of SDA";

export const TEAM_COLORS = ["#B23A3A", "#3B5BA5", "#4F8F53", "#D99A2B", "#6B4C8A", "#2F8C84", "#B8842A", "#5B6B8C"];

export function luminanceTextColor(hex: string): string {
  let c = hex.replace("#", "");
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1E2A22" : "#F3F5EE";
}

/** Win/draw/loss, points from each game's rule, and score for/against. `gameId` null means every game. */
export function computeRecords(
  churches: Church[], games: Game[], fixtures: Fixture[], gameId: string | null
): Record<string, Record3> {
  const rec: Record<string, Record3> = {};
  churches.forEach((c) => (rec[c.id] = { w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0 }));
  const gameById = new Map(games.map((g) => [g.id, g]));
  fixtures.forEach((f) => {
    if (f.status !== "final" || !f.outcome) return;
    if (gameId && f.gameId !== gameId) return;
    const a = rec[f.churchAId];
    const b = rec[f.churchBId];
    const game = f.gameId ? gameById.get(f.gameId) : undefined;
    if (!a || !b) return;
    const win = game?.pointsWin ?? 3, draw = game?.pointsDraw ?? 1, loss = game?.pointsLoss ?? 0;
    if (f.outcome === "A") { a.w++; b.l++; a.pts += win; b.pts += loss; }
    else if (f.outcome === "B") { b.w++; a.l++; b.pts += win; a.pts += loss; }
    else { a.d++; b.d++; a.pts += draw; b.pts += draw; }
    a.gf += f.scoreA ?? 0; a.ga += f.scoreB ?? 0;
    b.gf += f.scoreB ?? 0; b.ga += f.scoreA ?? 0;
  });
  return rec;
}

export function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Client-side check before uploading; returns an error message or null. */
export function photoProblem(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "Please upload a JPG, PNG, or WEBP photo.";
  if (file.size > PHOTO_MAX_BYTES) return "That photo is too large (max 5 MB).";
  return null;
}
