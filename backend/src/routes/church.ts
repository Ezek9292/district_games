import { Router } from "express";
import { prisma } from "../prisma";
import { broadcastOnSuccess } from "../lib/live";
import { photoUpload } from "../lib/photos";
import { createPlayer, deletePlayer, saveTeamSheet, setPlayerPhoto, sheetInclude, updatePlayer } from "../lib/roster";
import { requireChurch } from "../middleware/auth";

/** A signed-in church manages its own players and team sheets. */
export const churchRouter = Router();
churchRouter.use(requireChurch, broadcastOnSuccess);

churchRouter.get("/sheets", async (req, res) => {
  res.json(await prisma.teamSheet.findMany({ where: { churchId: req.church!.id }, include: sheetInclude }));
});

churchRouter.put("/fixtures/:id/sheet", async (req, res) => {
  res.json(await saveTeamSheet(req.params.id, req.church!.id, req.body));
});

churchRouter.post("/players", async (req, res) => {
  res.status(201).json(await createPlayer(req.church!.id, req.body));
});

churchRouter.patch("/players/:id", async (req, res) => {
  res.json(await updatePlayer(req.params.id, req.body, req.church!.id));
});

churchRouter.delete("/players/:id", async (req, res) => {
  await deletePlayer(req.params.id, req.church!.id);
  res.status(204).end();
});

churchRouter.post("/players/:id/photo", photoUpload.single("photo"), async (req, res) => {
  res.json(await setPlayerPhoto(String(req.params.id), req.file, req.church!.id));
});
