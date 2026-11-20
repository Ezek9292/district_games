"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { errMessage, TEAM_COLORS } from "@/lib/utils";
import type { Church, ChurchRepEmail } from "@/lib/types";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same rules as the server: emails lower-cased, Ghanaian numbers like 024 123 4567 become +233241234567. */
export function normalizeLogin(raw: string): string | null {
  const s = raw.trim();
  if (s.includes("@")) return EMAIL_RE.test(s) ? s.toLowerCase() : null;
  const d = s.replace(/[\s\-().]/g, "");
  if (/^0\d{9}$/.test(d)) return "+233" + d.slice(1);
  if (/^233\d{9}$/.test(d)) return "+" + d;
  if (/^00\d{8,15}$/.test(d)) return "+" + d.slice(2);
  if (/^\+\d{8,15}$/.test(d)) return d;
  return null;
}

/**
 * Adds a church, or edits `church`. Reps sign in to the church's page with any of its emails or phone
 * numbers; each can belong to only one church. On an existing church, they are added and removed straight away.
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
    if (!draft.trim()) return;
    const login = normalizeLogin(draft);
    if (!login) { toast("Enter a valid email address or phone number."); return; }
    if (emails.some((e) => e.login === login)) { toast("That's already on the list."); return; }
    if (!church) {
      // New church: the list is sent along when the church is created.
      setEmails((list) => [...list, { id: login, login, lastLoginAt: null }]);
      setDraft("");
      return;
    }
    setBusy(true);
    try {
      const added = await api<ChurchRepEmail>(`/api/churches/${church.id}/emails`, { method: "POST", body: { login } });
      setEmails((list) => [...list, added]);
      setDraft("");
    } catch (e) { toast(errMessage(e)); }
    finally { setBusy(false); }
  }

  async function removeEmail(rep: ChurchRepEmail) {
    if (!church) { setEmails((list) => list.filter((e) => e.id !== rep.id)); return; }
    if (!confirm(`Remove ${rep.login}? Anyone signed in with it will be signed out of ${church.name}.`)) return;
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
    if (draft.trim()) { toast('Tap "Add" to add what you typed, or clear it.'); return; }
    setBusy(true);
    try {
      if (church) await api(`/api/churches/${church.id}`, { method: "PATCH", body: { name: trimmed, color } });
      else await api("/api/churches", { method: "POST", body: { name: trimmed, color, emails: emails.map((e) => e.login) } });
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
        <label className="field-label">Church rep emails or phone numbers</label>
        {emails.length > 0 && (
          <ul className="email-list">
            {emails.map((rep) => (
              <li key={rep.id}>
                <span className="email-text">{rep.login}</span>
                <button
                  type="button" className="btn ghost sm" disabled={busy}
                  aria-label={`Remove ${rep.login}`} onClick={() => removeEmail(rep)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="email-add">
          <input
            type="text" autoCapitalize="none" spellCheck={false} placeholder="rep@example.com or 024 123 4567" value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
          />
          <button type="button" className="btn ghost" disabled={busy || !draft.trim()} onClick={addEmail}>Add</button>
        </div>
        <p className="pin-hint">
          Each rep signs in at <strong>/church</strong> with a code sent to their email or by SMS to their phone, to
          register players and submit team sheets. An email or number can belong to only one church.
          {church && " Changes here are saved straight away."}
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
