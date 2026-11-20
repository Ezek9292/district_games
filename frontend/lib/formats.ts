import type { Division, Fixture, Game, GameFormat, Player } from "./types";

type FormatRules = {
  label: string;
  /** "match": church A vs church B. "race": every entered church competes and is ranked. */
  kind: "match" | "race";
  draws: boolean;
  starters: number;
  maxSubs: number;
  scoreLabel: string;
};

/** Mirrors backend/src/lib/formats.ts, which enforces these limits. */
export const FORMATS: Record<GameFormat, FormatRules> = {
  football: { label: "Football", kind: "match", draws: true, starters: 11, maxSubs: 5, scoreLabel: "Goals" },
  volleyball: { label: "Volleyball", kind: "match", draws: false, starters: 6, maxSubs: 6, scoreLabel: "Sets won" },
  penalties: { label: "Penalty shoot-out", kind: "match", draws: false, starters: 5, maxSubs: 5, scoreLabel: "Penalties scored" },
  tableTennis: { label: "Table tennis", kind: "match", draws: false, starters: 1, maxSubs: 1, scoreLabel: "Games won" },
  draughts: { label: "Draughts", kind: "match", draws: true, starters: 1, maxSubs: 1, scoreLabel: "Games won" },
  sprint: { label: "100 metres", kind: "race", draws: false, starters: 1, maxSubs: 1, scoreLabel: "Place" },
  sackRace: { label: "Sack race", kind: "race", draws: false, starters: 1, maxSubs: 1, scoreLabel: "Place" },
  limeSpoon: { label: "Lime and spoon", kind: "race", draws: false, starters: 1, maxSubs: 1, scoreLabel: "Place" },
  ludo: { label: "Ludo", kind: "race", draws: false, starters: 1, maxSubs: 1, scoreLabel: "Place" },
};

export const FORMAT_KEYS = Object.keys(FORMATS) as GameFormat[];

export const DEFAULT_PLACE_POINTS = [5, 3, 2, 1];

export const isRace = (game: Pick<Game, "format"> | undefined | null) => !!game && FORMATS[game.format].kind === "race";

/** The churches taking part in a fixture, whichever kind it is. */
export function fixtureChurchIds(f: Fixture): string[] {
  return f.entries?.length
    ? f.entries.map((e) => e.churchId)
    : [f.churchAId, f.churchBId].filter((id): id is string => !!id);
}

export const DIVISIONS: Record<Division, string> = { men: "Men", women: "Women", open: "Open" };

export function startersLabel(format: GameFormat) {
  if (format === "penalties") return "Kickers";
  return FORMATS[format].starters === 1 ? "Player" : "Starting players";
}

export function subsLabel(format: GameFormat) {
  if (format === "penalties") return "Reserve kickers";
  return FORMATS[format].maxSubs === 1 ? "Reserve" : "Substitutes";
}

/** Why a player can't play this game, or null if they can. Same rules as the backend. */
export function ineligibleReason(game: Game, player: Player): string | null {
  if (game.division === "men" && player.gender !== "male") return "Men only";
  if (game.division === "women" && player.gender !== "female") return "Women only";
  if (game.eldersOnly && !player.isElder) return "Elders only";
  return null;
}

/** 1 → "1st", 2 → "2nd", 11 → "11th". */
export function ordinal(n: number) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

/** Points for finishing in `place` (1 = first). Places past the end of the list, or no place, get 0. */
export function placePoints(game: Pick<Game, "pointsPlaces"> | undefined, place: number | null) {
  if (!place) return 0;
  const list = game?.pointsPlaces?.length ? game.pointsPlaces : DEFAULT_PLACE_POINTS;
  return list[place - 1] ?? 0;
}

export function gameSummary(g: Game) {
  const f = FORMATS[g.format];
  const who = [g.division !== "open" ? DIVISIONS[g.division] : "", g.eldersOnly ? "Elders" : ""].filter(Boolean).join(", ");
  const kind = f.kind === "race" ? "all churches together" : "two churches";
  const squad = f.starters === 1 ? `1 player + ${f.maxSubs} reserve` : `${f.starters} + up to ${f.maxSubs} subs`;
  return `${f.label}${who ? `, ${who.toLowerCase()}` : ""}. ${kind[0].toUpperCase() + kind.slice(1)}, ${squad}`;
}

export function pointsSummary(g: Game) {
  if (isRace(g)) {
    const list = g.pointsPlaces?.length ? g.pointsPlaces : DEFAULT_PLACE_POINTS;
    return list.map((p, i) => `${ordinal(i + 1)} ${p}`).join(", ");
  }
  return FORMATS[g.format].draws
    ? `Win ${g.pointsWin}, draw ${g.pointsDraw}, loss ${g.pointsLoss}`
    : `Win ${g.pointsWin}, loss ${g.pointsLoss}`;
}
