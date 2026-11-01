import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { HttpError } from "../lib/http";
import { broadcastOnSuccess } from "../lib/live";
import { deletePhoto, photoUpload } from "../lib/photos";
import { createPlayer, deletePlayer, setPlayerPhoto, sheetInclude, updatePlayer } from "../lib/roster";
import { requireOrganizer } from "../middleware/auth";

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
const churchEmail = z
  .string().trim().toLowerCase()
  .transform((v) => v || null)
  .pipe(z.string().email("Enter a valid email for the church rep").nullable());

/** Includes rep emails, which the public state leaves out. */
adminRouter.get("/churches", async (_req, res) => {
  res.json(await prisma.church.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, email: true, lastLoginAt: true },
  }));
});

adminRouter.post("/churches", async (req, res) => {
  const data = z.object({ name, color, email: churchEmail.default("") }).parse(req.body);
  const order = await prisma.church.count();
  res.status(201).json(await prisma.church.create({ data: { ...data, order } }));
});

adminRouter.patch("/churches/:id", async (req, res) => {
  const data = z.object({ name, color, email: churchEmail }).partial().parse(req.body);
  res.json(await prisma.church.update({ where: { id: req.params.id }, data }));
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
  format: z.enum(["football", "volleyball", "penalties"]),
  division: z.enum(["men", "women", "open"]),
  eldersOnly: z.boolean().default(false),
  pointsWin: points.default(3),
  pointsDraw: points.default(1),
  pointsLoss: points.default(0),
});

adminRouter.post("/games", async (req, res) => {
  const data = gameSchema.parse(req.body);
  const order = await prisma.game.count();
  res.status(201).json(await prisma.game.create({ data: { ...data, order } }));
});

adminRouter.patch("/games/:id", async (req, res) => {
  const data = gameSchema.partial().parse(req.body);
  const before = await prisma.game.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, "Game not found");
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

// ---------- Fixtures ----------
const fixtureSchema = z
  .object({
    gameId: z.string().min(1, "Pick a game"),
    churchAId: z.string().min(1),
    churchBId: z.string().min(1),
    round: text(40).transform((v) => v || "Round 1"),
    time: text(40).default(""),
    location: text(60).default(""),
  })
  .refine((f) => f.churchAId !== f.churchBId, { message: "Church A and B must differ." });

adminRouter.post("/fixtures", async (req, res) => {
  const data = fixtureSchema.parse(req.body);
  res.status(201).json(await prisma.fixture.create({ data }));
});

adminRouter.put("/fixtures/:id", async (req, res) => {
  const data = fixtureSchema.parse(req.body);
  const before = await prisma.fixture.findUnique({ where: { id: req.params.id } });
  if (!before) throw new HttpError(404, "Fixture not found");
  const fixture = await prisma.fixture.update({ where: { id: req.params.id }, data });
  // Drop team sheets from churches no longer in this fixture, or all of them if the game changed.
  await prisma.teamSheet.deleteMany({
    where: before.gameId !== fixture.gameId
      ? { fixtureId: fixture.id }
      : { fixtureId: fixture.id, churchId: { notIn: [fixture.churchAId, fixture.churchBId] } },
  });
  res.json(fixture);
});

/** Records the final score (or clears it with nulls). Points come from the game's rule. */
adminRouter.put("/fixtures/:id/result", async (req, res) => {
  const score = z.coerce.number().int().min(0, "Scores can't be negative").max(999);
  const body = z
    .object({ scoreA: score.nullable(), scoreB: score.nullable(), scoreNote: text(40).optional() })
    .refine((b) => (b.scoreA === null) === (b.scoreB === null), { message: "Enter both scores." })
    .parse(req.body);

  const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id }, include: { game: true } });
  if (!fixture) throw new HttpError(404, "Fixture not found");

  if (body.scoreA === null || body.scoreB === null) {
    res.json(await prisma.fixture.update({
      where: { id: fixture.id },
      data: { scoreA: null, scoreB: null, outcome: null, status: "scheduled", scoreNote: body.scoreNote },
    }));
    return;
  }
  if (body.scoreA === body.scoreB && fixture.game && fixture.game.format !== "football") {
    throw new HttpError(400, `${fixture.game.name} can't end in a draw. Enter the deciding score.`);
  }
  const outcome = body.scoreA > body.scoreB ? "A" : body.scoreB > body.scoreA ? "B" : "draw";
  res.json(await prisma.fixture.update({
    where: { id: fixture.id },
    data: { scoreA: body.scoreA, scoreB: body.scoreB, outcome, status: "final", scoreNote: body.scoreNote },
  }));
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

adminRouter.post("/organizers", async (req, res) => {
  const data = z
    .object({ email: z.string().trim().toLowerCase().email("Enter a valid email address"), name: text(60).optional() })
    .parse(req.body);
  const existing = await prisma.organizer.findUnique({ where: { email: data.email } });
  if (existing) throw new HttpError(409, "That email is already an organizer.");
  res.status(201).json(await prisma.organizer.create({ data }));
});

adminRouter.delete("/organizers/:id", async (req, res) => {
  if (req.params.id === req.organizer!.id) throw new HttpError(400, "You can't remove yourself.");
  await prisma.organizer.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
