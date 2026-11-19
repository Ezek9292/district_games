"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errMessage, TEAM_COLORS } from "@/lib/utils";
import type { Church, ChurchRepEmail } from "@/lib/types";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Adds a church, or edits `church`. Reps sign in to the church's page with any of its emails;
 * an email can belong to only one church. On an existing church, emails are added and removed straight away.
 */
export function ChurchModal({
  church, emails: initialEmails, onClose,
}: {
  church?: Church;
  emails?: ChurchRepEmail[];
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(church?.name ?? "");
  const [color, setColor] = useState(church?.color ?? TEAM_COLORS[0]);
  const [emails, setEmails] = useState<ChurchRepEmail[]>(initialEmails ?? []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function addEmail() {
    const email = draft.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) { toast("Enter a valid email address."); return; }
    if (emails.some((e) => e.email === email)) { toast("That email is already on the list."); return; }
    if (!church) {
      // New church: the list is sent along when the church is created.
      setEmails((list) => [...list, { id: email, email, lastLoginAt: null }]);
      setDraft("");
      return;
    }
    setBusy(true);
    try {
      const added = await api<ChurchRepEmail>(`/api/churches/${church.id}/emails`, { method: "POST", body: { email } });
      setEmails((list) => [...list, added]);
      setDraft("");
    } catch (e) { toast(errMessage(e)); }
    finally { setBusy(false); }
  }

  async function removeEmail(rep: ChurchRepEmail) {
    if (!church) { setEmails((list) => list.filter((e) => e.id !== rep.id)); return; }
    if (!confirm(`Remove ${rep.email}? Anyone signed in with it will be signed out of ${church.name}.`)) return;
    setBusy(true);
    try {
      await api(`/api/churches/${church.id}/emails/${rep.id}`, { method: "DELETE" });
      setEmails((list) => list.filter((e) => e.id !== rep.id));
    } catch (e) { toast(errMessage(e)); }
    finally { setBusy(false); }
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) { toast("Enter a church name."); return; }
    if (draft.trim()) { toast('Tap "Add" to add the email you typed, or clear it.'); return; }
    setBusy(true);
    try {
      if (church) await api(`/api/churches/${church.id}`, { method: "PATCH", body: { name: trimmed, color } });
      else await api("/api/churches", { method: "POST", body: { name: trimmed, color, emails: emails.map((e) => e.email) } });
      onClose();
    } catch (e) { toast(errMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <Modal onClose={onClose}>
      <h3>{church ? "Edit Church" : "Add Church"}</h3>
      <div className="field">
        <label className="field-label">Church name</label>
        <input placeholder="e.g. Taifa Central SDA" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label className="field-label">Church rep emails</label>
        {emails.length > 0 && (
          <ul className="email-list">
            {emails.map((rep) => (
              <li key={rep.id}>
                <span className="email-text">{rep.email}</span>
                <button
                  type="button" className="btn ghost sm" disabled={busy}
                  aria-label={`Remove ${rep.email}`} onClick={() => removeEmail(rep)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="email-add">
          <input
            type="email" placeholder="rep@example.com" value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
          />
          <button type="button" className="btn ghost" disabled={busy || !draft.trim()} onClick={addEmail}>Add</button>
        </div>
        <p className="pin-hint">
          Each rep signs in at <strong>/church</strong> with a code sent to their email to register players and submit
          team sheets. An email can belong to only one church.
          {church && " Changes to emails are saved straight away."}
        </p>
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
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn accent" onClick={save} disabled={busy}>{church ? "Save" : "Add Church"}</button>
      </div>
    </Modal>
  );
}
