import type { Game, Outcome, Player } from "@prisma/client";
import { FORMATS } from "./formats";
import { HttpError } from "./http";

// Pure tournament rules (no database), so they can be unit-tested. See rules.test.ts.

type GameRules = Pick<Game, "name" | "format" | "division" | "eldersOnly">;
type PlayerInfo = Pick<Player, "id" | "name" | "gender" | "isElder">;

/** Why a player can't play this game, or null if they can. */
export function ineligibleReason(game: GameRules, player: PlayerInfo): string | null {
  if (game.division === "men" && player.gender !== "male") return `${player.name} can't play in a men's game`;
  if (game.division === "women" && player.gender !== "female") return `${player.name} can't play in a women's game`;
  if (game.eldersOnly && !player.isElder) return `${player.name} isn't registered as an elder`;
  return null;
}

/**
 * Throws unless the picked starters/subs make a valid sheet for this game.
 * `ownPlayers` are the picked players that belong to the submitting church.
 */
export function checkTeamSheet(game: GameRules, starters: string[], subs: string[], ownPlayers: PlayerInfo[]) {
  const rules = FORMATS[game.format];
  const ids = [...starters, ...subs];
  if (starters.length !== rules.starters) {
    throw new HttpError(400, `${game.name} needs exactly ${rules.starters} starting players (you picked ${starters.length}).`);
  }
  if (subs.length > rules.maxSubs) {
    throw new HttpError(400, `${game.name} allows at most ${rules.maxSubs} substitutes (you picked ${subs.length}).`);
  }
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "A player can only be picked once.");
  if (ownPlayers.length !== ids.length) throw new HttpError(400, "Only your own registered players can be picked.");
  for (const p of ownPlayers) {
    const reason = ineligibleReason(game, p);
    if (reason) throw new HttpError(400, reason + ".");
  }
}

/** Who won a final score. Only football can end in a draw. */
export function resultOutcome(game: Pick<Game, "name" | "format"> | null, scoreA: number, scoreB: number): Outcome {
  if (scoreA === scoreB && game && game.format !== "football") {
    throw new HttpError(400, `${game.name} can't end in a draw. Enter the deciding score.`);
  }
  return scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "draw";
}
