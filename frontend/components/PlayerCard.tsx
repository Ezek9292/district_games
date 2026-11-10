"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { playerPaths, type RosterScope } from "@/lib/players";
import { errMessage, photoProblem, photoSrc } from "@/lib/utils";
import type { Church, Player } from "@/lib/types";
import { useToast } from "./Toast";
import { PlayerDetailsModal } from "./modals/PlayerDetailsModal";

export function Headshot({ player, size = 64 }: { player: Player; size?: number }) {
  return (
    <span className="headshot" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {player.photoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photoSrc(player.photoUrl, size * 2)} alt="" loading="lazy" />
        : (player.name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Uploads a new photo for `player` when `scope` allows editing the roster. */
export function usePhotoUpload(player: Player, scope?: RosterScope) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const paths = scope && playerPaths(scope, player.churchId);

  async function upload(file: File) {
    if (!paths) return;
    const problem = photoProblem(file);
    if (problem) { toast(problem); return; }
    const body = new FormData();
    body.append("photo", file);
    setUploading(true);
    try {
      await api(`${paths.item(player.id)}/photo`, { method: "POST", body });
      toast("Photo updated.");
    } catch (e) {
      toast("Upload failed: " + errMessage(e));
    } finally {
      setUploading(false);
    }
  }

  return { uploading, upload: paths ? upload : undefined };
}

/** A hidden file picker that calls `onFile`, laid over its parent. */
export function PhotoInput({ onFile }: { onFile: (file: File) => void }) {
  return (
    <input
      type="file" accept="image/jpeg,image/png,image/webp" className="file-overlay"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
        e.target.value = "";
      }}
    />
  );
}

/**
 * A roster tile. Tapping it opens the player's profile with a large photo.
 * With `scope`, the photo is uploadable (📷) and the player editable/removable.
 */
export function PlayerCard({
  player, church, scope, onEdit,
}: {
  player: Player;
  church?: Church;
  scope?: RosterScope;
  onEdit?: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const { uploading, upload } = usePhotoUpload(player, scope);

  function remove() {
    if (scope && confirm(`Remove ${player.name}?`)) {
      api(playerPaths(scope, player.churchId).item(player.id), { method: "DELETE" }).catch((e) => toast(errMessage(e)));
    }
  }

  return (
    <div className={"player" + (scope ? " unlocked" : "")}>
      <div className={"headshot-wrap" + (uploading ? " busy" : "")}>
        <button type="button" className="headshot-btn" onClick={() => setOpen(true)} aria-label={`View ${player.name}`}>
          <Headshot player={player} />
        </button>
        {upload && (
          <label className="upload-dot" title="Change photo">
            {uploading ? "…" : "📷"}
            <PhotoInput onFile={upload} />
          </label>
        )}
      </div>
      <button type="button" className="player-open" onClick={() => setOpen(true)}>
        <div className="pname">{player.name}</div>
        <div className="pnum">
          {player.number && `#${player.number} · `}
          {player.gender === "male" ? "M" : "F"}
          {player.isElder && " · Elder"}
        </div>
      </button>
      {scope && (
        <>
          <button className="rm" aria-label={`Remove ${player.name}`} onClick={remove}>×</button>
          {onEdit && <button className="edit-link" onClick={onEdit}>Edit</button>}
        </>
      )}
      {open && (
        <PlayerDetailsModal
          player={player} church={church}
          onPhoto={upload} uploading={uploading}
          onEdit={onEdit && (() => { setOpen(false); onEdit(); })}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
