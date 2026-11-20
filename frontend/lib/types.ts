export type Church = { id: string; name: string; color: string; order: number };

export type GameFormat =
  | "football" | "volleyball" | "penalties" | "tableTennis" | "draughts"
  | "sprint" | "sackRace" | "limeSpoon" | "ludo";
export type Division = "men" | "women" | "open";

export type Game = {
  id: string;
  name: string;
  description: string;
  format: GameFormat;
  division: Division;
  eldersOnly: boolean;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  /** All-church events: points for 1st, 2nd, 3rd... */
  pointsPlaces: number[];
  order: number;
};

export type Outcome = "A" | "B" | "draw" | null;

export type Fixture = {
  id: string;
  gameId: string | null;
  /** Two-church matches only; null for an all-church event. */
  churchAId: string | null;
  churchBId: string | null;
  /** All-church events: each church taking part and where it finished (1 = first). */
  entries: FixtureEntry[];
  round: string;
  time: string;
  location: string;
  scoreNote: string;
  scoreA: number | null;
  scoreB: number | null;
  status: "scheduled" | "final";
  outcome: Outcome;
  /** Set once a super organizer approves the result (or entered it). A final result without it is pending. */
  approvedAt: string | null;
  /** Who entered the result; only sent to organizers. */
  enteredBy: string | null;
  /** Tournament fixtures (football, volleyball): group stage, semi-final or final. Null otherwise. */
  stage: "group" | "semi" | "final" | null;
  /** Group stage: "A" or "B". */
  groupName: string | null;
  /** Semi-finals: 1 = winner A v runner-up B, 2 = winner B v runner-up A. */
  slot: number | null;
};

export type FixtureEntry = { churchId: string; place: number | null };

export type Gender = "male" | "female";

export type Player = {
  id: string;
  churchId: string;
  name: string;
  number: string;
  gender: Gender;
  isElder: boolean;
  photoUrl: string | null;
};

export type SheetRole = "starter" | "sub";

export type TeamSheet = {
  id: string;
  fixtureId: string;
  churchId: string;
  updatedAt: string;
  players: { playerId: string; role: SheetRole; order: number }[];
};

export type EventInfo = { name: string; subtitle: string };

export type TournamentState = {
  event: EventInfo;
  churches: Church[];
  games: Game[];
  fixtures: Fixture[];
  players: Player[];
  /** Only for games already played; churches see their own through /api/church/sheets. */
  teamSheets: TeamSheet[];
};

/** `login` is the email or phone number (+233...) the organizer signs in with. */
export type Organizer = { id: string; login: string; name: string | null; isSuper: boolean; lastLoginAt?: string | null };

/** The email or phone number a church session signed in with. */
export type ChurchAccount = { id: string; name: string; color: string; login: string };

/** A church rep's sign-in email or phone number; only organizers see these. */
export type ChurchRepEmail = { id: string; login: string; lastLoginAt: string | null };

export type Session =
  | { role: "organizer"; organizer: Organizer }
  | { role: "church"; church: ChurchAccount };

/** Matches: won/drawn/lost and score for/against. Events: how many entered (ev) and podium finishes. */
export type Record3 = {
  w: number; d: number; l: number; pts: number; gf: number; ga: number;
  ev: number; p1: number; p2: number; p3: number;
};
