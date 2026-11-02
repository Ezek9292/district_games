import { test } from "node:test";
import assert from "node:assert/strict";
import type { Game, Player } from "@prisma/client";
import { checkTeamSheet, ineligibleReason, resultOutcome } from "./rules";

type G = Pick<Game, "name" | "format" | "division" | "eldersOnly">;
type P = Pick<Player, "id" | "name" | "gender" | "isElder">;

const game = (over: Partial<G> = {}): G => ({ name: "Football", format: "football", division: "open", eldersOnly: false, ...over });
const squad = (n: number, over: Partial<P> = {}): P[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, gender: "male", isElder: false, ...over }));
const ids = (players: P[]) => players.map((p) => p.id);

/** Asserts that fn throws an HttpError 400 whose message matches. */
function rejects(fn: () => void, message: RegExp) {
  assert.throws(fn, (err: any) => err.status === 400 && message.test(err.message));
}

test("eligibility: men's, women's and elders-only games", () => {
  const man = squad(1)[0];
  const woman = { ...man, gender: "female" as const };
  const elder = { ...man, isElder: true };
  assert.equal(ineligibleReason(game(), man), null);
  assert.equal(ineligibleReason(game(), woman), null);
  assert.equal(ineligibleReason(game({ division: "men" }), man), null);
  assert.match(ineligibleReason(game({ division: "men" }), woman)!, /men's game/);
  assert.match(ineligibleReason(game({ division: "women" }), man)!, /women's game/);
  assert.match(ineligibleReason(game({ eldersOnly: true }), man)!, /elder/);
  assert.equal(ineligibleReason(game({ eldersOnly: true }), elder), null);
});

test("team sheet sizes per format", () => {
  const p = squad(16);
  // Football: exactly 11 starters, up to 5 subs.
  checkTeamSheet(game(), ids(p.slice(0, 11)), ids(p.slice(11, 16)), p);
  checkTeamSheet(game(), ids(p.slice(0, 11)), [], p.slice(0, 11));
  rejects(() => checkTeamSheet(game(), ids(p.slice(0, 10)), [], p.slice(0, 10)), /exactly 11/);
  rejects(() => checkTeamSheet(game(), ids(p.slice(0, 12)), [], p.slice(0, 12)), /exactly 11/);
  const p17 = squad(17);
  rejects(() => checkTeamSheet(game(), ids(p17.slice(0, 11)), ids(p17.slice(11)), p17), /at most 5/);

  // Volleyball: 6 + up to 6. Penalties: 5 + up to 5.
  const volley = game({ name: "Volleyball", format: "volleyball" });
  checkTeamSheet(volley, ids(p.slice(0, 6)), ids(p.slice(6, 12)), p.slice(0, 12));
  rejects(() => checkTeamSheet(volley, ids(p.slice(0, 6)), ids(p.slice(6, 13)), p.slice(0, 13)), /at most 6/);
  const pens = game({ name: "Penalties", format: "penalties" });
  checkTeamSheet(pens, ids(p.slice(0, 5)), ids(p.slice(5, 10)), p.slice(0, 10));
  rejects(() => checkTeamSheet(pens, ids(p.slice(0, 6)), [], p.slice(0, 6)), /exactly 5/);
});

test("team sheet rejects duplicates, other churches' players and ineligible players", () => {
  const p = squad(11);
  const dup = [...ids(p.slice(0, 10)), "p0"];
  rejects(() => checkTeamSheet(game(), dup, [], p.slice(0, 10)), /only be picked once/);
  // Starter in the middle of the list is a duplicate of a sub.
  rejects(() => checkTeamSheet(game(), ids(p), ["p3"], p), /only be picked once/);
  // One picked id isn't among the church's own players.
  rejects(() => checkTeamSheet(game(), ids(p), [], p.slice(0, 10)), /your own registered players/);
  // A woman in a men's game.
  const mixed = [...p.slice(0, 10), { ...p[10], gender: "female" as const }];
  rejects(() => checkTeamSheet(game({ division: "men" }), ids(mixed), [], mixed), /men's game/);
  // Non-elder in an elders-only game.
  const elders = squad(11, { isElder: true });
  checkTeamSheet(game({ eldersOnly: true }), ids(elders), [], elders);
  rejects(() => checkTeamSheet(game({ eldersOnly: true }), ids(p), [], p), /elder/);
});

test("result outcome; only football can be drawn", () => {
  assert.equal(resultOutcome(game(), 2, 1), "A");
  assert.equal(resultOutcome(game(), 0, 3), "B");
  assert.equal(resultOutcome(game(), 1, 1), "draw");
  assert.equal(resultOutcome(null, 1, 1), "draw");
  assert.equal(resultOutcome(game({ format: "volleyball" }), 3, 1), "A");
  rejects(() => resultOutcome(game({ name: "Volleyball", format: "volleyball" }), 2, 2), /can't end in a draw/);
  rejects(() => resultOutcome(game({ name: "Penalties", format: "penalties" }), 4, 4), /can't end in a draw/);
});
