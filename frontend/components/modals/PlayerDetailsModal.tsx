"use client";

import { createPortal } from "react-dom";
import type { Church, Player } from "@/lib/types";
import { ChurchChip } from "../ChurchChip";
import { Modal } from "../Modal";
import { PhotoInput } from "../PlayerCard";

/**
 * A player's profile with a large, clear photo. Rendered into <body> so it isn't
 * affected by the tile or list it was opened from.
 */
export function PlayerDetailsModal({
  player, church, onPhoto, uploading, onEdit, onClose,
}: {
  player: Player;
  church?: Church;
  /** Set when the viewer may change the photo. */
  onPhoto?: (file: File) => void;
  uploading?: boolean;
  onEdit?: () => void;
  onClose: () => void;
}) {
  return createPortal(
    <Modal onClose={onClose}>
      <div className="profile">
        <div className={"profile-photo" + (uploading ? " busy" : "")}>
          {player.photoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={player.photoUrl} alt={`Photo of ${player.name}`} />
            : (player.name || "?").trim().charAt(0).toUpperCase()}
        </div>
        <h3>{player.name}</h3>
        {church && <div className="profile-church"><ChurchChip church={church} /></div>}
        <dl className="profile-facts">
          <div><dt>Number</dt><dd>{player.number ? `#${player.number}` : "—"}</dd></div>
          <div><dt>Gender</dt><dd>{player.gender === "male" ? "Male" : "Female"}</dd></div>
          <div><dt>Elder</dt><dd>{player.isElder ? "Yes" : "No"}</dd></div>
        </dl>
        {!player.photoUrl && <p className="muted" style={{ margin: "12px 0 0" }}>No photo uploaded yet.</p>}
        <div className="modal-actions">
          {onPhoto && (
            <label className="btn ghost photo-btn">
              {uploading ? "Uploading…" : player.photoUrl ? "Change photo" : "Add photo"}
              <PhotoInput onFile={onPhoto} />
            </label>
          )}
          {onEdit && <button className="btn ghost" onClick={onEdit}>Edit details</button>}
          <button className="btn accent" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>,
    document.body
  );
}
