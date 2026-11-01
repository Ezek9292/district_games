import { Router } from "express";
import { prisma } from "../prisma";
import { sheetInclude } from "../lib/roster";
import { streamHandler } from "../lib/live";

export const publicRouter = Router();

/** Everything a viewer needs in one request. */
publicRouter.get("/state", async (_req, res) => {
  const [event, churches, games, fixtures, players, teamSheets] = await Promise.all([
    prisma.event.findUnique({ where: { id: 1 } }),
    prisma.church.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, color: true, order: true },
    }),
    prisma.game.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.fixture.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.player.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, churchId: true, name: true, number: true, gender: true, isElder: true, photoUrl: true },
    }),
    // Line-ups stay private to each church until the game has been played.
    prisma.teamSheet.findMany({ where: { fixture: { status: "final" } }, include: sheetInclude }),
  ]);
  res.set("Cache-Control", "no-store");
  res.json({
    event: event ?? { name: "Taifa District of SDA", subtitle: "" },
    churches,
    games,
    fixtures,
    players,
    teamSheets,
  });
});

publicRouter.get("/stream", streamHandler);
