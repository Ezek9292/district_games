"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errMessage } from "@/lib/utils";
import type { Organizer } from "@/lib/types";
import { useAuth } from "../Auth";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

/** Everyone sees who the organizers are; only a super organizer adds or removes them. */
export function OrganizersModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { organizer: me, signOut } = useAuth();
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [login, setLogin] = useState("");
  const isSuper = !!me?.isSuper;

  const load = () => api<Organizer[]>("/api/organizers").then(setOrganizers).catch((e) => toast(errMessage(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    if (!login.trim()) return;
    try {
      await api("/api/organizers", { method: "POST", body: { login } });
      setLogin("");
      load();
    } catch (e) { toast(errMessage(e)); }
  }

  async function remove(o: Organizer) {
    if (!confirm(`Remove ${o.login} as an organizer?`)) return;
    try {
      await api(`/api/organizers/${o.id}`, { method: "DELETE" });
      load();
    } catch (e) { toast(errMessage(e)); }
  }

  return (
    <Modal onClose={onClose}>
      <h3>Organizers</h3>
      <p className="muted">
        Signed in as <strong>{me?.login}</strong>{isSuper && " (super organizer)"}. Organizers sign in with a code sent
        to their email or by SMS. Results entered by organizers count once a super organizer approves them.
      </p>
      <ul className="email-list">
        {organizers.map((o) => (
          <li key={o.id}>
            <span className="email-text">
              {o.login}
              {o.isSuper && <span className="tag">Super</span>}
            </span>
            {isSuper && o.id !== me?.id && (
              <button type="button" className="btn ghost sm danger" onClick={() => remove(o)}>Remove</button>
            )}
          </li>
        ))}
      </ul>
      {isSuper ? (
        <div className="field">
          <label className="field-label" htmlFor="new-organizer">Add organizer by email or phone number</label>
          <div className="email-add">
            <input
              id="new-organizer" name="login" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false}
              placeholder="name@example.com or 024 123 4567" value={login}
              onChange={(e) => setLogin(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            />
            <button type="button" className="btn" onClick={add}>Add</button>
          </div>
        </div>
      ) : (
        <p className="muted hint">Only the super organizer can add or remove organizers.</p>
      )}
      <div className="modal-actions">
        <button type="button" className="btn danger" onClick={() => { signOut("organizer"); onClose(); toast("Signed out"); }}>Sign out</button>
        <button type="button" className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
