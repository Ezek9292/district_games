export type Church = { id: string; name: string; color: string; order: number };

export type GameFormat = "football" | "volleyball" | "penalties";
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
  order: number;
};

export type Outcome = "A" | "B" | "draw" | null;

export type Fixture = {
  id: string;
  gameId: string | null;
  churchAId: string;
  churchBId: string;
  round: string;
  time: string;
  location: string;
  scoreNote: string;
  scoreA: number | null;
  scoreB: number | null;
  status: "scheduled" | "final";
  outcome: Outcome;
};

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

export type Organizer = { id: string; email: string; name: string | null; lastLoginAt?: string | null };

export type ChurchAccount = { id: string; name: string; color: string; email: string | null };

export type Session =
  | { role: "organizer"; organizer: Organizer }
  | { role: "church"; church: ChurchAccount };

export type Record3 = { w: number; d: number; l: number; pts: number; gf: number; ga: number };
