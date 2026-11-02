import { test } from "node:test";
import assert from "node:assert/strict";
import type { Church, Fixture, Game } from "./types.ts";
import { computeRecords } from "./utils.ts";

const churches: Church[] = ["a", "b", "c"].map((id, order) => ({ id, name: id.toUpperCase(), color: "#000", order }));

const game = (id: string, over: Partial<Game> = {}): Game => ({
  id, name: id, description: "", format: "football", division: "open", eldersOnly: false,
  pointsWin: 3, pointsDraw: 1, pointsLoss: 0, order: 0, ...over,
});

let n = 0;
const played = (gameId: string | null, churchAId: string, churchBId: string, scoreA: number, scoreB: number): Fixture => ({
  id: `f${n++}`, gameId, churchAId, churchBId, round: "", time: "", location: "", scoreNote: "", scoreA, scoreB,
  status: "final", outcome: scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "draw",
});

test("wins, draws, losses, points and goals", () => {
  const games = [game("football")];
  const fixtures = [played("football", "a", "b", 2, 0), played("football", "b", "c", 1, 1), played("football", "c", "a", 3, 1)];
  const rec = computeRecords(churches, games, fixtures, null);
  assert.deepEqual(rec.a, { w: 1, d: 0, l: 1, pts: 3, gf: 3, ga: 3 });
  assert.deepEqual(rec.b, { w: 0, d: 1, l: 1, pts: 1, gf: 1, ga: 3 });
  assert.deepEqual(rec.c, { w: 1, d: 1, l: 0, pts: 4, gf: 4, ga: 2 });
});

test("uses each game's own points rule", () => {
  const games = [game("football"), game("volleyball", { format: "volleyball", pointsWin: 2, pointsLoss: 1 })];
  const fixtures = [played("football", "a", "b", 1, 0), played("volleyball", "b", "a", 3, 1)];
  const rec = computeRecords(churches, games, fixtures, null);
  assert.equal(rec.a.pts, 3 + 1);
  assert.equal(rec.b.pts, 0 + 2);
});

test("filters by game and skips unplayed fixtures", () => {
  const games = [game("football"), game("volleyball", { format: "volleyball" })];
  const scheduled: Fixture = { ...played("football", "a", "c", 0, 0), status: "scheduled", scoreA: null, scoreB: null, outcome: null };
  const fixtures = [played("football", "a", "b", 1, 0), played("volleyball", "b", "a", 3, 0), scheduled];
  const rec = computeRecords(churches, games, fixtures, "football");
  assert.deepEqual(rec.a, { w: 1, d: 0, l: 0, pts: 3, gf: 1, ga: 0 });
  assert.deepEqual(rec.c, { w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0 });
});

test("fixtures without a game fall back to 3/1/0", () => {
  const rec = computeRecords(churches, [], [played(null, "a", "b", 0, 0), played(null, "a", "c", 2, 1)], null);
  assert.equal(rec.a.pts, 1 + 3);
  assert.equal(rec.b.pts, 1);
});

test("ignores fixtures involving a removed church", () => {
  const rec = computeRecords(churches, [game("football")], [played("football", "a", "gone", 5, 0)], null);
  assert.deepEqual(rec.a, { w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0 });
});
