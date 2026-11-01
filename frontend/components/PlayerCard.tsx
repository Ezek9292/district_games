"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { playerPaths, type RosterScope } from "@/lib/players";
import { errMessage, photoProblem } from "@/lib/utils";
import type { Player } from "@/lib/types";
import { useToast } from "./Toast";

export function Headshot({ player, size = 64 }: { player: Player; size?: number }) {
  return (
    <span className="headshot" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {player.photoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={player.photoUrl} alt="" />
        : (player.name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** A roster tile. With `scope`, the photo is uploadable and the player editable/removable. */
export function PlayerCard({
  player, scope, onEdit,
}: {
  player: Player;
  scope?: RosterScope;
  onEdit?: () => void;
}) {
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

  function remove() {
    if (paths && confirm(`Remove ${player.name}?`)) {
      api(paths.item(player.id), { method: "DELETE" }).catch((e) => toast(errMessage(e)));
    }
  }

  return (
    <div className={"player" + (scope ? " unlocked" : "")}>
      <label className={"headshot-wrap" + (uploading ? " busy" : "")} title={scope ? "Change photo" : undefined}>
        <Headshot player={player} />
        {scope && (
          <>
            <input
              type="file" accept="image/jpeg,image/png,image/webp" className="file-overlay"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
                e.target.value = "";
              }}
            />
            <span className="upload-dot">{uploading ? "…" : "📷"}</span>
          </>
        )}
      </label>
      <div className="pname">{player.name}</div>
      <div className="pnum">
        {player.number && `#${player.number} · `}
        {player.gender === "male" ? "M" : "F"}
        {player.isElder && " · Elder"}
      </div>
      {scope && (
        <>
          <button className="rm" aria-label={`Remove ${player.name}`} onClick={remove}>×</button>
          {onEdit && <button className="edit-link" onClick={onEdit}>Edit</button>}
        </>
      )}
    </div>
  );
}
