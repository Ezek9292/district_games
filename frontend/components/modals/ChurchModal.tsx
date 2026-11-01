"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errMessage, TEAM_COLORS } from "@/lib/utils";
import type { Church } from "@/lib/types";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

/** Adds a church, or edits `church`. The rep email is how the church signs in to its page. */
export function ChurchModal({
  church, email: currentEmail, onClose,
}: {
  church?: Church;
  email?: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(church?.name ?? "");
  const [color, setColor] = useState(church?.color ?? TEAM_COLORS[0]);
  const [email, setEmail] = useState(currentEmail ?? "");

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { toast("Enter a church name."); return; }
    const body = { name: trimmed, color, email };
    try {
      if (church) await api(`/api/churches/${church.id}`, { method: "PATCH", body });
      else await api("/api/churches", { method: "POST", body });
      onClose();
    } catch (e) { toast(errMessage(e)); }
  }

  return (
    <Modal onClose={onClose}>
      <h3>{church ? "Edit Church" : "Add Church"}</h3>
      <div className="field">
        <label className="field-label">Church name</label>
        <input placeholder="e.g. Taifa Central SDA" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label className="field-label">Church rep email</label>
        <input type="email" placeholder="rep@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <p className="pin-hint">The rep signs in at <strong>/church</strong> with a code sent here to register players and submit team sheets.</p>
      </div>
      <div className="field">
        <label className="field-label">Team color</label>
        <div className="swatches">
          {TEAM_COLORS.map((c) => (
            <button
              key={c} type="button" aria-label={`Color ${c}`}
              className={"sw" + (c === color ? " sel" : "")}
              style={{ background: c }} onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn accent" onClick={save}>{church ? "Save" : "Add Church"}</button>
      </div>
    </Modal>
  );
}
