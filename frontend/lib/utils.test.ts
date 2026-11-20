import { test } from "node:test";
import assert from "node:assert/strict";
import type { Church, Fixture, Game } from "./types.ts";
import { computeRecords, emptyRecord, photoSrc } from "./utils.ts";

const churches: Church[] = ["a", "b", "c"].map((id, order) => ({ id, name: id.toUpperCase(), color: "#000", order }));

const game = (id: string, over: Partial<Game> = {}): Game => ({
  id, name: id, description: "", format: "football", division: "open", eldersOnly: false,
  pointsWin: 3, pointsDraw: 1, pointsLoss: 0, pointsPlaces: [5, 3, 2, 1], order: 0, ...over,
});

let n = 0;
const played = (gameId: string | null, churchAId: string, churchBId: string, scoreA: number, scoreB: number): Fixture => ({
  id: `f${n++}`, gameId, churchAId, churchBId, round: "", time: "", location: "", scoreNote: "", scoreA, scoreB,
  entries: [], approvedAt: "2026-11-20T10:00:00Z", enteredBy: null, status: "final", outcome: scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "draw",
});

test("wins, draws, losses, points and goals", () => {
  const games = [game("football")];
  const fixtures = [played("football", "a", "b", 2, 0), played("football", "b", "c", 1, 1), played("football", "c", "a", 3, 1)];
  const rec = computeRecords(churches, games, fixtures, null);
  assert.deepEqual(rec.a, { ...emptyRecord(), w: 1, d: 0, l: 1, pts: 3, gf: 3, ga: 3 });
  assert.deepEqual(rec.b, { ...emptyRecord(), w: 0, d: 1, l: 1, pts: 1, gf: 1, ga: 3 });
  assert.deepEqual(rec.c, { ...emptyRecord(), w: 1, d: 1, l: 0, pts: 4, gf: 4, ga: 2 });
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
  assert.deepEqual(rec.a, { ...emptyRecord(), w: 1, d: 0, l: 0, pts: 3, gf: 1, ga: 0 });
  assert.deepEqual(rec.c, { ...emptyRecord(), w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0 });
});

test("fixtures without a game fall back to 3/1/0", () => {
  const rec = computeRecords(churches, [], [played(null, "a", "b", 0, 0), played(null, "a", "c", 2, 1)], null);
  assert.equal(rec.a.pts, 1 + 3);
  assert.equal(rec.b.pts, 1);
});

test("ignores fixtures involving a removed church", () => {
  const rec = computeRecords(churches, [game("football")], [played("football", "a", "gone", 5, 0)], null);
  assert.deepEqual(rec.a, { ...emptyRecord(), w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0 });
});

test("photoSrc asks Cloudinary for a small copy and leaves other URLs alone", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/v1712/players/abc.jpg";
  assert.equal(photoSrc(url, 128), "https://res.cloudinary.com/demo/image/upload/c_fill,g_face,w_128,h_128,q_auto,f_auto/v1712/players/abc.jpg");
  assert.equal(photoSrc("https://example.com/a.jpg", 128), "https://example.com/a.jpg");
});

test("all-church events give points by place, ties share a place", () => {
  const games = [game("sprint", { format: "sprint", pointsPlaces: [5, 3, 1] }), game("football")];
  const race = (places: Record<string, number | null>): Fixture => ({
    id: `f${n++}`, gameId: "sprint", churchAId: null, churchBId: null, round: "", time: "", location: "", scoreNote: "",
    scoreA: null, scoreB: null, status: "final", outcome: null, approvedAt: "2026-11-20T10:00:00Z", enteredBy: null,
    entries: Object.entries(places).map(([churchId, place]) => ({ churchId, place })),
  });
  const fixtures = [race({ a: 1, b: 2, c: 3 }), race({ a: 2, b: 2, c: null }), played("football", "c", "a", 1, 0)];
  const all = computeRecords(churches, games, fixtures, null);
  assert.equal(all.a.pts, 5 + 3);
  assert.equal(all.b.pts, 3 + 3);
  assert.equal(all.c.pts, 1 + 0 + 3);
  const sprint = computeRecords(churches, games, fixtures, "sprint");
  assert.deepEqual(sprint.a, { ...emptyRecord(), ev: 2, p1: 1, p2: 1, pts: 8 });
  assert.deepEqual(sprint.c, { ...emptyRecord(), ev: 2, p3: 1, pts: 1 });
  // An event not yet final counts for nothing.
  const pending = { ...race({ a: 1, b: 2 }), status: "scheduled" as const };
  assert.equal(computeRecords(churches, games, [pending], null).a.pts, 0);
});

test("results awaiting approval don't count", () => {
  const games = [game("football")];
  const pending: Fixture = { ...played("football", "a", "b", 3, 0), approvedAt: null };
  const rec = computeRecords(churches, games, [pending, played("football", "b", "c", 1, 0)], "football");
  assert.equal(rec.a.pts, 0);
  assert.equal(rec.a.w, 0);
  assert.equal(rec.b.pts, 3);
});
