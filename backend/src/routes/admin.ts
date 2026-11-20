import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../lib/http";
import { broadcastOnSuccess } from "../lib/live";
import { deletePhoto, photoUpload } from "../lib/photos";
import { createPlayer, deletePlayer, setPlayerPhoto, sheetInclude, updatePlayer } from "../lib/roster";
import { FORMAT_KEYS, isRace } from "../lib/formats";
import { checkPlaces, resultOutcome } from "../lib/rules";
import { GROUPS, knockoutPlan, roundRobin } from "../lib/tournament";
import { loginSchema } from "../lib/login";
import { requireOrganizer, requireSuperOrganizer } from "../middleware/auth";

/** Every route here requires a signed-in organizer. */
export const adminRouter = Router();
adminRouter.use(requireOrganizer, broadcastOnSuccess);

const text = (max: number) => z.string().trim().max(max);
const name = z.string().trim().min(1, "Name is required").max(60);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a team color");

// ---------- Event ----------
adminRouter.put("/event", async (req, res) => {
  const data = z.object({ name, subtitle: text(60).default("") }).parse(req.body);
  const event = await prisma.event.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  res.json(event);
});

// ---------- Churches ----------
/** A rep's email or phone number, normalized (phones become +233...). */
const churchLogin = loginSchema("Enter a valid email or phone number for the church rep");
const emailSelect = { id: true, login: true, lastLoginAt: true } as const;

/** A login can belong to only one church; says which one already has it. */
async function assertLoginsFree(logins: string[], churchId?: string) {
  const clash = await prisma.churchEmail.findFirst({ where: { login: { in: logins } }, include: { church: true } });
  if (!clash) return;
  throw new HttpError(409, clash.churchId === churchId
    ? `${clash.login} is already a rep login for this church.`
    : `${clash.login} is already a rep login for ${clash.church.name}. Remove it there first.`);
}

/** Includes rep emails, which the public state leaves out. */
adminRouter.get("/churches", async (_req, res) => {
  res.json(await prisma.church.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, lastLoginAt: true, emails: { select: emailSelect, orderBy: { createdAt: "asc" } } },
  }));
});

adminRouter.post("/churches", async (req, res) => {
  const { emails, ...data } = z
    .object({ name, color, emails: z.array(churchLogin).max(20, "Up to 20 rep logins per church").default([]) })
    .parse(req.body);
  const unique = [...new Set(emails)];
  await assertLoginsFree(unique);
  const order = await prisma.church.count();
  res.status(201).json(await prisma.church.create({
    data: { ...data, order, emails: { create: unique.map((login) => ({ login })) } },
    include: { emails: { select: emailSelect } },
  }));
});

adminRouter.patch("/churches/:id", async (req, res) => {
  const data = z.object({ name, color }).partial().parse(req.body);
  res.json(await prisma.church.update({ where: { id: req.params.id }, data }));
});

adminRouter.post("/churches/:id/emails", async (req, res) => {
  const login = churchLogin.parse(req.body?.login ?? req.body?.email);
  const church = await prisma.church.findUnique({ where: { id: req.params.id } });
  if (!church) throw new HttpError(404, "Church not found");
  await assertLoginsFree([login], church.id);
  res.status(201).json(await prisma.churchEmail.create({ data: { login, churchId: church.id }, select: emailSelect }));
});

/** Removing an email also ends any session signed in with it (see requireChurch). */
adminRouter.delete("/churches/:id/emails/:emailId", async (req, res) => {
  const { count } = await prisma.churchEmail.deleteMany({ where: { id: req.params.emailId, churchId: req.params.id } });
  if (!count) throw new HttpError(404, "That login isn't on this church.");
  res.status(204).end();
});

adminRouter.delete("/churches/:id", async (req, res) => {
  const players = await prisma.player.findMany({ where: { churchId: req.params.id }, select: { photoPublicId: true } });
  await prisma.church.delete({ where: { id: req.params.id } });
  await Promise.all(players.map((p) => deletePhoto(p.photoPublicId)));
  res.status(204).end();
});

// ---------- Games ----------
const points = z.coerce.number().int().min(0, "Points can't be negative").max(100);
const gameSchema = z.object({
  name,
  description: text(300).default(""),
  format: z.enum(FORMAT_KEYS),
  division: z.enum(["men", "women", "open"]),
  eldersOnly: z.boolean().default(false),
  pointsWin: points.default(3),
  pointsDraw: points.default(1),
  pointsLoss: points.default(0),
  pointsPlaces: z.array(points).min(1, "Give points for at least 1st place").max(30).default([5, 3, 2, 1]),
});

adminRouter.post("/games", async (req, res) => {
  const data = gameSchema.parse(req.body);
  const order = await prisma.game.count();
  res.status(201).json(await prisma.game.create({ data: { ...data, order } }));
});

adminRouter.patch("/games/:id", async (req, res) => {
  const data = gameSchema.partial().parse(req.body);
  const before = await prisma.game.findUnique({ where: { id: req.params.id }, include: { _count: { select: { fixtures: true } } } });
  if (!before) throw new HttpError(404, "Game not found");
  // A two-church match and an all-church event store their fixtures differently.
  if (data.format && isRace(data.format) !== isRace(before.format) && before._count.fixtures) {
    throw new HttpError(400, `${before.name} already has fixtures. Remove them before switching between a two-church match and an all-church event.`);
  }
  const game = await prisma.game.update({ where: { id: req.params.id }, data });
  // Line-ups picked under the old rules may no longer fit; churches re-submit them.
  if (game.format !== before.format || game.division !== before.division || game.eldersOnly !== before.eldersOnly) {
    await prisma.teamSheet.deleteMany({ where: { fixture: { gameId: game.id, status: "scheduled" } } });
  }
  res.json(game);
});

adminRouter.delete("/games/:id", async (req, res) => {
  await prisma.game.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ---------- Tournaments (football, volleyball) ----------
/**
 * Sets a game up as a tournament: the churches in each group play each other once, then
 * semi-finals (A1 v B2, B1 v A2) and a final, whose churches fill in as results are approved.
 * Replaces the game's existing fixtures, as long as none of them has a result yet.
 */
adminRouter.post("/games/:id/tournament", async (req, res) => {
  const ids = z.array(z.string().min(1)).min(2, "Each group needs at least 2 churches").max(8, "Up to 8 churches per group");
  const body = z.object({ groupA: ids, groupB: ids }).parse(req.body);
  const game = await prisma.game.findUnique({ where: { id: req.params.id }, include: { fixtures: true } });
  if (!game) throw new HttpError(404, "Game not found");
  if (isRace(game.format)) throw new HttpError(400, "Only two-church games like football and volleyball can be played as a tournament.");
  const all = [...body.groupA, ...body.groupB];
  if (new Set(all).size !== all.length) throw new HttpError(400, "A church can only be in one group, once.");
  if (await prisma.church.count({ where: { id: { in: all } } }) !== all.length) throw new HttpError(400, "One of those churches no longer exists.");
  if (game.fixtures.some((f) => f.status === "final")) {
    throw new HttpError(400, `${game.name} already has results. Clear them before setting up the tournament again.`);
  }

  const groups = { A: body.groupA, B: body.groupB };
  const fixtures = await prisma.$transaction(async (tx) => {
    await tx.fixture.deleteMany({ where: { gameId: game.id } });
    for (const g of GROUPS) {
      for (const [a, b] of roundRobin(groups[g])) {
        await tx.fixture.create({ data: { gameId: game.id, churchAId: a, churchBId: b, round: `Group ${g}`, stage: "group", groupName: g } });
      }
    }
    for (const slot of [1, 2]) {
      await tx.fixture.create({ data: { gameId: game.id, round: "Semi-finals", stage: "semi", slot } });
    }
    await tx.fixture.create({ data: { gameId: game.id, round: "Final", stage: "final" } });
    return tx.fixture.count({ where: { gameId: game.id } });
  });
  res.status(201).json({ fixtures });
});

/**
 * Puts the right churches into the game's knockout matches that haven't been played yet, from the
 * approved group results and semi-finals. A slot the results don't decide yet is left as it is,
 * so an organizer can still fill it by hand (e.g. to settle a tie).
 */
async function advanceKnockout(gameId: string | null) {
  if (!gameId) return;
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return;
  const fixtures = await prisma.fixture.findMany({ where: { gameId, stage: { not: null } } });
  if (!fixtures.some((f) => f.stage === "group")) return;
  const plan = knockoutPlan(game, fixtures);
  const targets = [
    { f: fixtures.find((f) => f.stage === "semi" && f.slot === 1), want: plan.semi1 },
    { f: fixtures.find((f) => f.stage === "semi" && f.slot === 2), want: plan.semi2 },
    { f: fixtures.find((f) => f.stage === "final"), want: plan.final },
  ];
  for (const { f, want } of targets) {
    if (!f || f.status !== "scheduled") continue;
    const churchAId = want[0] ?? f.churchAId;
    const churchBId = want[1] ?? f.churchBId;
    if (churchAId === f.churchAId && churchBId === f.churchBId) continue;
    await prisma.fixture.update({ where: { id: f.id }, data: { churchAId, churchBId } });
    // Line-ups picked by a church that is no longer in this match are dropped.
    const keep = [churchAId, churchBId].filter((id): id is string => !!id);
    await prisma.teamSheet.deleteMany({ where: { fixtureId: f.id, churchId: { notIn: keep } } });
  }
}

// ---------- Fixtures ----------
const fixtureSchema = z.object({
  gameId: z.string().min(1, "Pick a game"),
  /** Two-church matches. */
  churchAId: z.string().min(1).nullish(),
  churchBId: z.string().min(1).nullish(),
  /** All-church events: every church taking part. */
  churchIds: z.array(z.string().min(1)).max(100).default([]),
  round: text(40).transform((v) => v || "Round 1"),
  time: text(40).default(""),
  location: text(60).default(""),
});

/** Validates a fixture against its game's kind and returns what to store. */
async function fixtureData(body: unknown, knockout = false) {
  const { churchIds, ...data } = fixtureSchema.parse(body);
  const game = await prisma.game.findUnique({ where: { id: data.gameId } });
  if (!game) throw new HttpError(400, "That game no longer exists.");
  if (isRace(game.format)) {
    const ids = [...new Set(churchIds)];
    if (ids.length < 2) throw new HttpError(400, `Pick at least 2 churches for ${game.name}.`);
    return { data: { ...data, churchAId: null, churchBId: null }, churchIds: ids };
  }
  if (data.churchAId && data.churchAId === data.churchBId) throw new HttpError(400, "Church A and B must differ.");
  // A semi-final or final can wait for its churches; they fill in from the results.
  if (knockout) return { data: { ...data, churchAId: data.churchAId || null, churchBId: data.churchBId || null }, churchIds: [] as string[] };
  if (!data.churchAId || !data.churchBId) throw new HttpError(400, "Pick both churches.");
  return { data, churchIds: [] as string[] };
}

const fixtureInclude = { entries: { select: { churchId: true, place: true } } } as const;

adminRouter.post("/fixtures", async (req, res) => {
  const { data, churchIds } = await fixtureData(req.body);
  res.status(201).json(await prisma.fixture.create({
    data: { ...data, entries: { create: churchIds.map((churchId) => ({ churchId })) } },
    include: fixtureInclude,
  }));
});

adminRouter.put("/fixtures/:id", async (req, res) => {
  const before = await prisma.fixture.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, "Fixture not found");
  const { data, churchIds } = await fixtureData(req.body, before.stage === "semi" || before.stage === "final");
  const fixture = await prisma.$transaction(async (tx) => {
    // Keep places already entered for churches still in the event.
    await tx.fixtureEntry.deleteMany({ where: { fixtureId: before.id, churchId: { notIn: churchIds } } });
    await tx.fixtureEntry.createMany({ data: churchIds.map((churchId) => ({ fixtureId: before.id, churchId })), skipDuplicates: true });
    return tx.fixture.update({ where: { id: before.id }, data, include: fixtureInclude });
  });
  const taking = [fixture.churchAId, fixture.churchBId, ...churchIds].filter((id): id is string => !!id);
  // Drop team sheets from churches no longer in this fixture, or all of them if the game changed.
  await prisma.teamSheet.deleteMany({
    where: before.gameId !== fixture.gameId
      ? { fixtureId: fixture.id }
      : { fixtureId: fixture.id, churchId: { notIn: taking } },
  });
  await advanceKnockout(fixture.gameId);
  res.json(fixture);
});

/**
 * Who entered a result, and whether it counts yet. A super organizer's results count straight away;
 * anyone else's wait for a super organizer to approve them. Clearing a result clears both.
 */
function approval(req: Request, hasResult: boolean) {
  if (!hasResult) return { approvedAt: null, enteredById: null };
  return { approvedAt: req.organizer!.isSuper ? new Date() : null, enteredById: req.organizer!.id };
}

/** A super organizer accepts a result another organizer entered. */
adminRouter.put("/fixtures/:id/approve", requireSuperOrganizer, async (req, res) => {
  const fixture = await prisma.fixture.findUnique({ where: { id: String(req.params.id) } });
  if (!fixture) throw new HttpError(404, "Fixture not found");
  if (fixture.status !== "final") throw new HttpError(400, "There's no result to approve yet.");
  const updated = await prisma.fixture.update({
    where: { id: fixture.id },
    data: { approvedAt: fixture.approvedAt ?? new Date() },
    include: fixtureInclude,
  });
  await advanceKnockout(fixture.gameId);
  res.json(updated);
});

/** A super organizer turns a result down: it is cleared so the fixture can be scored again. */
adminRouter.put("/fixtures/:id/reject", requireSuperOrganizer, async (req, res) => {
  const fixture = await prisma.fixture.findUnique({ where: { id: String(req.params.id) } });
  if (!fixture) throw new HttpError(404, "Fixture not found");
  if (fixture.status !== "final" || fixture.approvedAt) throw new HttpError(400, "Only results awaiting approval can be rejected.");
  const [, updated] = await prisma.$transaction([
    prisma.fixtureEntry.updateMany({ where: { fixtureId: fixture.id }, data: { place: null } }),
    prisma.fixture.update({
      where: { id: fixture.id },
      data: { status: "scheduled", scoreA: null, scoreB: null, outcome: null, approvedAt: null, enteredById: null },
      include: fixtureInclude,
    }),
  ]);
  await advanceKnockout(fixture.gameId);
  res.json(updated);
});

/** Records where each church finished in an all-church event (or clears it with `places: null`). */
adminRouter.put("/fixtures/:id/places", async (req, res) => {
  const place = z.coerce.number().int().nullable();
  const body = z
    .object({ places: z.record(z.string(), place).nullable(), scoreNote: text(40).optional() })
    .parse(req.body);
  const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, include: { game: true, entries: true } });
  if (!fixture) throw new HttpError(404, "Fixture not found");
  if (!fixture.game || !isRace(fixture.game.format)) throw new HttpError(400, "This fixture is a two-church match. Enter a score instead.");

  const places = body.places;
  if (places) checkPlaces(fixture.entries.map((e) => e.churchId), places);
  const updated = await prisma.$transaction(async (tx) => {
    for (const e of fixture.entries) {
      await tx.fixtureEntry.update({
        where: { fixtureId_churchId: { fixtureId: fixture.id, churchId: e.churchId } },
        data: { place: places?.[e.churchId] ?? null },
      });
    }
    return tx.fixture.update({
      where: { id: fixture.id },
      data: { status: places ? "final" : "scheduled", scoreA: null, scoreB: null, outcome: null, scoreNote: body.scoreNote, ...approval(req, !!places) },
      include: fixtureInclude,
    });
  });
  res.json(updated);
});

/** Records the final score (or clears it with nulls). Points come from the game's rule. */
adminRouter.put("/fixtures/:id/result", async (req, res) => {
  const score = z.coerce.number().int().min(0, "Scores can't be negative").max(999);
  const body = z
    .object({ scoreA: score.nullable(), scoreB: score.nullable(), scoreNote: text(40).optional(), winner: z.enum(["A", "B"]).optional() })
    .refine((b) => (b.scoreA === null) === (b.scoreB === null), { message: "Enter both scores." })
    .parse(req.body);

  const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, include: { game: true } });
  if (!fixture) throw new HttpError(404, "Fixture not found");
  if (fixture.game && isRace(fixture.game.format)) throw new HttpError(400, "This is an all-church event. Enter places instead.");
  if (!fixture.churchAId || !fixture.churchBId) throw new HttpError(400, "Both churches for this match aren't known yet.");

  if (body.scoreA === null || body.scoreB === null) {
    res.json(await prisma.fixture.update({
      where: { id: fixture.id },
      data: { scoreA: null, scoreB: null, outcome: null, status: "scheduled", scoreNote: body.scoreNote, ...approval(req, false) },
    }));
    await advanceKnockout(fixture.gameId);
    return;
  }
  const knockout = fixture.stage === "semi" || fixture.stage === "final";
  const outcome = resultOutcome(fixture.game, body.scoreA, body.scoreB, { knockout, winner: body.winner });
  const updated = await prisma.fixture.update({
    where: { id: fixture.id },
    data: { scoreA: body.scoreA, scoreB: body.scoreB, outcome, status: "final", scoreNote: body.scoreNote, ...approval(req, true) },
  });
  await advanceKnockout(fixture.gameId);
  res.json(updated);
});

adminRouter.delete("/fixtures/:id", async (req, res) => {
  await prisma.fixture.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

adminRouter.get("/fixtures/:id/sheets", async (req, res) => {
  res.json(await prisma.teamSheet.findMany({ where: { fixtureId: req.params.id }, include: sheetInclude }));
});

// ---------- Players ----------
adminRouter.post("/churches/:churchId/players", async (req, res) => {
  res.status(201).json(await createPlayer(req.params.churchId, req.body));
});

adminRouter.patch("/players/:id", async (req, res) => {
  res.json(await updatePlayer(req.params.id, req.body));
});

adminRouter.delete("/players/:id", async (req, res) => {
  await deletePlayer(req.params.id);
  res.status(204).end();
});

adminRouter.post("/players/:id/photo", photoUpload.single("photo"), async (req, res) => {
  res.json(await setPlayerPhoto(String(req.params.id), req.file));
});

// ---------- Organizers ----------
adminRouter.get("/organizers", async (_req, res) => {
  res.json(await prisma.organizer.findMany({ orderBy: { createdAt: "asc" } }));
});

adminRouter.post("/organizers", requireSuperOrganizer, async (req, res) => {
  const body = z.object({ login: z.string().optional(), email: z.string().optional(), name: text(60).optional() }).parse(req.body);
  const login = loginSchema().parse(body.login ?? body.email ?? "");
  const existing = await prisma.organizer.findUnique({ where: { login } });
  if (existing) throw new HttpError(409, "That email or phone number is already an organizer.");
  res.status(201).json(await prisma.organizer.create({ data: { login, name: body.name } }));
});

adminRouter.delete("/organizers/:id", requireSuperOrganizer, async (req, res) => {
  if (req.params.id === req.organizer!.id) throw new HttpError(400, "You can't remove yourself.");
  await prisma.organizer.delete({ where: { id: String(req.params.id) } });
  res.status(204).end();
});
