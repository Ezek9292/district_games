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

/**
 * Who won a final score. Only football and draughts can end in a draw, and never in a knockout match:
 * a level knockout score (e.g. decided on penalties) needs `winner`.
 */
export function resultOutcome(
  game: Pick<Game, "name" | "format"> | null, scoreA: number, scoreB: number,
  { knockout = false, winner }: { knockout?: boolean; winner?: "A" | "B" } = {}
): Outcome {
  if (scoreA !== scoreB) return scoreA > scoreB ? "A" : "B";
  if (knockout) {
    if (!winner) throw new HttpError(400, "A knockout match needs a winner. Pick who went through (e.g. on penalties).");
    return winner;
  }
  if (game && !FORMATS[game.format].draws) {
    throw new HttpError(400, `${game.name} can't end in a draw. Enter the deciding score.`);
  }
  return "draw";
}

/**
 * Checks the finishing places of an all-church event. `places` maps each entered church to
 * its place (1 = first), or null if it didn't finish. Ties share a place, so 1, 1, 3 is fine,
 * but a place can't be higher than the number of churches entered.
 */
export function checkPlaces(entered: string[], places: Record<string, number | null>) {
  const extra = Object.keys(places).find((id) => !entered.includes(id));
  if (extra) throw new HttpError(400, "Only churches entered in this event can be placed.");
  const given = entered.map((id) => places[id] ?? null);
  if (!given.some((p) => p !== null)) throw new HttpError(400, "Enter at least one church's place.");
  for (const p of given) {
    if (p !== null && (!Number.isInteger(p) || p < 1 || p > entered.length)) {
      throw new HttpError(400, `Places run from 1 to ${entered.length}.`);
    }
  }
}
