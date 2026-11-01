"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { playerPaths, type RosterScope } from "@/lib/players";
import { errMessage, photoProblem } from "@/lib/utils";
import type { Gender, Player } from "@/lib/types";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

/** Registers a new player (with optional photo), or edits `player`. */
export function PlayerModal({
  churchId, scope, player, onClose,
}: {
  churchId: string;
  scope: RosterScope;
  player?: Player;
  onClose: () => void;
}) {
  const toast = useToast();
  const paths = playerPaths(scope, churchId);
  const [name, setName] = useState(player?.name ?? "");
  const [number, setNumber] = useState(player?.number ?? "");
  const [gender, setGender] = useState<Gender | "">(player?.gender ?? "");
  const [isElder, setIsElder] = useState(player?.isElder ?? false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { toast("Enter the player's name."); return; }
    if (!gender) { toast("Pick the player's gender."); return; }
    const body = { name: trimmed, number, gender, isElder };
    setBusy(true);
    try {
      const saved = player
        ? await api<Player>(paths.item(player.id), { method: "PATCH", body })
        : await api<Player>(paths.create, { method: "POST", body });
      if (photo) {
        const form = new FormData();
        form.append("photo", photo);
        try {
          await api(`${paths.item(saved.id)}/photo`, { method: "POST", body: form });
        } catch (e) {
          toast(`${trimmed} was saved, but the photo failed: ${errMessage(e)}`);
        }
      }
      onClose();
    } catch (e) { toast(errMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose}>
      <h3>{player ? "Edit Player" : "Register Player"}</h3>
      <div className="field">
        <label className="field-label">Full name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field-label">Gender</label>
          <select value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
            <option value="" disabled>Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label">Jersey no. (optional)</label>
          <input inputMode="numeric" maxLength={3} value={number} onChange={(e) => setNumber(e.target.value)} />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={isElder} onChange={(e) => setIsElder(e.target.checked)} />
        <span>Church elder <span className="muted">(can play in the elders&apos; penalty shoot-out)</span></span>
      </label>
      <div className="field">
        <label className="field-label">{player?.photoUrl ? "Replace photo (optional)" : "Photo (optional)"}</label>
        <input
          type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            const problem = file && photoProblem(file);
            if (problem) { toast(problem); e.target.value = ""; return; }
            setPhoto(file);
          }}
        />
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn accent" onClick={save} disabled={busy}>{busy ? "Saving…" : player ? "Save" : "Register"}</button>
      </div>
    </Modal>
  );
}
