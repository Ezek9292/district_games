import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "./http";
import { deletePhoto, uploadPhoto } from "./photos";
import { checkTeamSheet } from "./rules";

export const playerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  number: z.string().trim().max(3).default(""),
  gender: z.enum(["male", "female"], { message: "Pick the player's gender" }),
  isElder: z.boolean().default(false),
});

/** Finds a player, and when `churchId` is given, makes sure it belongs to that church. */
async function findPlayer(id: string, churchId?: string) {
  const player = await prisma.player.findUnique({ where: { id } });
  if (!player || (churchId && player.churchId !== churchId)) throw new HttpError(404, "Player not found");
  return player;
}

export function createPlayer(churchId: string, body: unknown) {
  const data = playerSchema.parse(body);
  return prisma.player.create({ data: { ...data, churchId } });
}

export async function updatePlayer(id: string, body: unknown, churchId?: string) {
  await findPlayer(id, churchId);
  const data = playerSchema.partial().parse(body);
  return prisma.player.update({ where: { id }, data });
}

export async function deletePlayer(id: string, churchId?: string) {
  const player = await findPlayer(id, churchId);
  await prisma.player.delete({ where: { id } });
  await deletePhoto(player.photoPublicId);
}

export async function setPlayerPhoto(id: string, file: Express.Multer.File | undefined, churchId?: string) {
  if (!file) throw new HttpError(400, "No photo uploaded");
  const player = await findPlayer(id, churchId);
  const photo = await uploadPhoto(file.buffer);
  const updated = await prisma.player.update({
    where: { id },
    data: { photoUrl: photo.url, photoPublicId: photo.publicId },
  });
  await deletePhoto(player.photoPublicId);
  return updated;
}

const sheetSchema = z.object({
  starters: z.array(z.string()).default([]),
  subs: z.array(z.string()).default([]),
});

/** Replaces a church's team sheet for a fixture after checking it against the game's rules. */
export async function saveTeamSheet(fixtureId: string, churchId: string, body: unknown) {
  const { starters, subs } = sheetSchema.parse(body);

  const ids = [...starters, ...subs];
  const [fixture, players] = await Promise.all([
    prisma.fixture.findUnique({ where: { id: fixtureId }, include: { game: true, entries: { select: { churchId: true } } } }),
    prisma.player.findMany({ where: { id: { in: ids }, churchId } }),
  ]);
  const takesPart = fixture
    && (fixture.churchAId === churchId || fixture.churchBId === churchId || fixture.entries.some((e) => e.churchId === churchId));
  if (!fixture || !takesPart) {
    throw new HttpError(404, "Fixture not found");
  }
  if (fixture.status === "final") throw new HttpError(400, "This game has been played; its team sheet is locked.");
  const game = fixture.game;
  if (!game) throw new HttpError(400, "This fixture has no game yet.");

  checkTeamSheet(game, starters, subs, players);

  const rows = [
    ...starters.map((playerId, order) => ({ playerId, role: "starter" as const, order })),
    ...subs.map((playerId, order) => ({ playerId, role: "sub" as const, order })),
  ];
  return prisma.$transaction(async (tx) => {
    const sheet = await tx.teamSheet.upsert({
      where: { fixtureId_churchId: { fixtureId, churchId } },
      update: { updatedAt: new Date() },
      create: { fixtureId, churchId },
    });
    await tx.teamSheetPlayer.deleteMany({ where: { sheetId: sheet.id } });
    await tx.teamSheetPlayer.createMany({ data: rows.map((r) => ({ ...r, sheetId: sheet.id })) });
    return tx.teamSheet.findUniqueOrThrow({ where: { id: sheet.id }, include: sheetInclude });
  });
}

export const sheetInclude = {
  players: { select: { playerId: true, role: true, order: true }, orderBy: [{ role: "asc" }, { order: "asc" }] },
} satisfies Prisma.TeamSheetInclude;
