import { Router } from "express";
import { prisma } from "../prisma";
import { sheetInclude } from "../lib/roster";
import { streamHandler } from "../lib/live";
import { optionalOrganizer } from "../middleware/auth";

export const publicRouter = Router();

/**
 * Everything a viewer needs in one request. Results still awaiting a super organizer's approval
 * are only shown to organizers; everyone else sees those fixtures as not played yet.
 */
publicRouter.get("/state", async (req, res) => {
  const organizer = await optionalOrganizer(req);
  const [event, churches, games, fixtures, players, teamSheets] = await Promise.all([
    prisma.event.findUnique({ where: { id: 1 } }),
    prisma.church.findMany({
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, color: true, order: true },
    }),
    prisma.game.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.fixture.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        entries: { select: { churchId: true, place: true } },
        enteredBy: { select: { login: true, name: true } },
      },
    }),
    prisma.player.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, churchId: true, name: true, number: true, gender: true, isElder: true, photoUrl: true },
    }),
    // Line-ups stay private to each church until the game has been played and its result approved.
    prisma.teamSheet.findMany({ where: { fixture: { status: "final", approvedAt: { not: null } } }, include: sheetInclude }),
  ]);

  const visible = fixtures.map(({ enteredById: _id, enteredBy, ...f }) => {
    const pending = f.status === "final" && !f.approvedAt;
    if (organizer) return { ...f, enteredBy: enteredBy && (enteredBy.name || enteredBy.login) };
    if (!pending) return { ...f, enteredBy: null };
    return {
      ...f, status: "scheduled" as const, scoreA: null, scoreB: null, outcome: null, scoreNote: "", enteredBy: null,
      entries: f.entries.map((e) => ({ ...e, place: null })),
    };
  });

  res.set("Cache-Control", "no-store");
  res.json({
    event: event ?? { name: "Taifa District of SDA", subtitle: "" },
    churches,
    games,
    fixtures: visible,
    players,
    teamSheets,
  });
});

publicRouter.get("/stream", streamHandler);
