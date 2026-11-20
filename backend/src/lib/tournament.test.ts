import { test } from "node:test";
import assert from "node:assert/strict";
import type { Fixture } from "@prisma/client";
import { groupComplete, groupTable, knockoutPlan, roundRobin } from "./tournament";

type F = Parameters<typeof groupTable>[1][number];
const game = { pointsWin: 3, pointsDraw: 1, pointsLoss: 0 };

const match = (group: string, a: string, b: string, sa: number | null, sb: number | null, over: Partial<F> = {}): F => ({
  churchAId: a, churchBId: b, scoreA: sa, scoreB: sb,
  outcome: sa === null || sb === null ? null : sa > sb ? "A" : sb > sa ? "B" : "draw",
  status: sa === null ? "scheduled" : "final",
  approvedAt: sa === null ? null : new Date(),
  stage: "group", groupName: group, slot: null, ...over,
} as F);

test("round robin: 3 churches play 3 matches, 2 each", () => {
  const pairs = roundRobin(["x", "y", "z"]);
  assert.equal(pairs.length, 3);
  for (const id of ["x", "y", "z"]) assert.equal(pairs.filter((p) => p.includes(id)).length, 2);
  assert.equal(roundRobin(["a", "b", "c", "d"]).length, 6);
});

test("group table ranks by points, then score difference, then scored", () => {
  const fixtures = [match("A", "a1", "a2", 2, 0), match("A", "a2", "a3", 1, 1), match("A", "a1", "a3", 0, 1)];
  const t = groupTable(game, fixtures, "A");
  // a1: 3 pts (+1), a3: 4 pts, a2: 1 pt.
  assert.deepEqual(t.map((r) => [r.churchId, r.pts]), [["a3", 4], ["a1", 3], ["a2", 1]]);
});

test("pending (unapproved) results don't count and keep the group open", () => {
  const fixtures = [match("A", "a1", "a2", 2, 0), match("A", "a2", "a3", 1, 0, { approvedAt: null }), match("A", "a1", "a3", 3, 0)];
  assert.equal(groupComplete(fixtures, "A"), false);
  assert.equal(groupTable(game, fixtures, "A").find((r) => r.churchId === "a2")!.pts, 0);
});

test("semis: A1 v B2 and B1 v A2, filled per group as each finishes; final from semi winners", () => {
  const groupA = [match("A", "a1", "a2", 2, 0), match("A", "a2", "a3", 1, 0), match("A", "a1", "a3", 3, 0)];
  const groupBOpen = [match("B", "b1", "b2", 1, 0), match("B", "b2", "b3", null, null), match("B", "b1", "b3", 2, 0)];
  let plan = knockoutPlan(game, [...groupA, ...groupBOpen]);
  assert.deepEqual(plan.semi1, ["a1", null]);
  assert.deepEqual(plan.semi2, [null, "a2"]);

  const groupB = [match("B", "b1", "b2", 1, 0), match("B", "b2", "b3", 2, 0), match("B", "b1", "b3", 2, 0)];
  const semis = [
    match("", "a1", "b2", 0, 0, { stage: "semi", groupName: null, slot: 1, outcome: "B" }), // b2 wins on penalties
    match("", "b1", "a2", null, null, { stage: "semi", groupName: null, slot: 2 }),
  ];
  plan = knockoutPlan(game, [...groupA, ...groupB, ...semis]);
  assert.deepEqual(plan.semi1, ["a1", "b2"]);
  assert.deepEqual(plan.semi2, ["b1", "a2"]);
  assert.deepEqual(plan.final, ["b2", null]);
});

// Keep the Fixture import used for type-checking the fixture shape.
export type _Check = Pick<Fixture, "stage">;
