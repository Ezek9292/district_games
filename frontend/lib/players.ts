/** Organizers manage any church's players; a signed-in church manages its own. */
export type RosterScope = "organizer" | "church";

export function playerPaths(scope: RosterScope, churchId: string) {
  return scope === "church"
    ? { create: "/api/church/players", item: (id: string) => `/api/church/players/${id}` }
    : { create: `/api/churches/${churchId}/players`, item: (id: string) => `/api/players/${id}` };
}
