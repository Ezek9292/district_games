"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errMessage } from "@/lib/utils";
import type { Organizer } from "@/lib/types";
import { useAuth } from "../Auth";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

export function OrganizersModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { organizer: me, signOut } = useAuth();
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [email, setEmail] = useState("");

  const load = () => api<Organizer[]>("/api/organizers").then(setOrganizers).catch((e) => toast(errMessage(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    try {
      await api("/api/organizers", { method: "POST", body: { email } });
      setEmail("");
      load();
    } catch (e) { toast(errMessage(e)); }
  }

  async function remove(o: Organizer) {
    if (!confirm(`Remove ${o.email} as an organizer?`)) return;
    try {
      await api(`/api/organizers/${o.id}`, { method: "DELETE" });
      load();
    } catch (e) { toast(errMessage(e)); }
  }

  return (
    <Modal onClose={onClose}>
      <h3>Organizers</h3>
      <p className="muted">Signed in as <strong>{me?.email}</strong>. Organizers sign in with a code sent to their email.</p>
      <ul className="email-list">
        {organizers.map((o) => (
          <li key={o.id}>
            <span className="email-text">{o.email}</span>
            {o.id !== me?.id && <button type="button" className="btn ghost sm danger" onClick={() => remove(o)}>Remove</button>}
          </li>
        ))}
      </ul>
      <div className="field">
        <label className="field-label" htmlFor="new-organizer">Add organizer by email</label>
        <div className="email-add">
          <input id="new-organizer" name="email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <button type="button" className="btn" onClick={add}>Add</button>
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn danger" onClick={() => { signOut("organizer"); onClose(); toast("Signed out"); }}>Sign out</button>
        <button type="button" className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
