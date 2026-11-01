"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { DEFAULT_EVENT_NAME, errMessage, TEAM_COLORS } from "@/lib/utils";
import type { Church, Fixture, Game, Player } from "@/lib/types";
import { useTournamentData } from "@/hooks/useTournamentData";
import { useAuth } from "./Auth";
import { useToast } from "./Toast";
import { Standings } from "./Standings";
import { Schedule } from "./Schedule";
import { Teams } from "./Teams";
import { LoginModal } from "./modals/LoginModal";
import { OrganizersModal } from "./modals/OrganizersModal";
import { FixtureModal } from "./modals/FixtureModal";
import { ChurchModal } from "./modals/ChurchModal";
import { PlayerModal } from "./modals/PlayerModal";
import { GameModal } from "./modals/GameModal";
import { ResultModal } from "./modals/ResultModal";
import { LineupsModal } from "./modals/LineupsModal";

type Tab = "standings" | "schedule" | "teams";

type ModalState =
  | null
  | { kind: "login" }
  | { kind: "organizers" }
  | { kind: "fixture"; fixture: Fixture | null }
  | { kind: "result"; fixture: Fixture }
  | { kind: "lineups"; fixture: Fixture }
  | { kind: "church"; church?: Church }
  | { kind: "player"; churchId: string; player?: Player }
  | { kind: "game"; game?: Game };

export default function Tournament() {
  const toast = useToast();
  const { organizer, church: signedInChurch } = useAuth();
  const isOrganizer = !!organizer;
  const { state, error, playersByChurch } = useTournamentData();

  const [tab, setTab] = useState<Tab>("standings");
  const [modal, setModal] = useState<ModalState>(null);
  const closeModal = () => setModal(null);

  const churches = state?.churches ?? [];
  const games = state?.games ?? [];
  const fixtures = state?.fixtures ?? [];
  const eventName = state?.event.name || DEFAULT_EVENT_NAME;
  const pennantColors = churches.length ? churches.map((c) => c.color) : TEAM_COLORS.slice(0, 6);
  const gameById = (id: string | null) => games.find((g) => g.id === id);
  const churchById = (id: string) => churches.find((c) => c.id === id);

  // Rep emails aren't public; organizers fetch them separately, again whenever the board changes.
  const [churchEmails, setChurchEmails] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (!isOrganizer) { setChurchEmails({}); return; }
    api<{ id: string; email: string | null }[]>("/api/churches")
      .then((rows) => setChurchEmails(Object.fromEntries(rows.map((r) => [r.id, r.email]))))
      .catch(() => {});
  }, [isOrganizer, state]);

  function saveEventName(el: HTMLElement) {
    if (!isOrganizer) return;
    const v = (el.textContent ?? "").trim().slice(0, 60) || DEFAULT_EVENT_NAME;
    el.textContent = v;
    if (v === state?.event.name) return;
    api("/api/event", { method: "PUT", body: { name: v, subtitle: state?.event.subtitle || "" } })
      .catch((e) => toast(errMessage(e)));
  }

  function openFixtureModal(fixture: Fixture | null) {
    if (!churches.length || !games.length) {
      toast("Add at least one church and one game first.");
      return;
    }
    setModal({ kind: "fixture", fixture });
  }

  return (
    <>
      <div className="pennants">
        {pennantColors.map((c, i) => <i key={i} style={{ background: c }} />)}
      </div>
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            <h1
              key={eventName + String(isOrganizer)}
              contentEditable={isOrganizer}
              suppressContentEditableWarning
              onBlur={(e) => saveEventName(e.currentTarget)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            >
              {eventName}
            </h1>
            <span className="sub">{state?.event.subtitle || ""}</span>
          </div>
          <div className="header-actions">
            <Link className="org-toggle" href="/church">
              <span>{signedInChurch ? `${signedInChurch.name} ›` : "Church portal"}</span>
            </Link>
            <button
              className={"org-toggle" + (isOrganizer ? " on" : "")}
              onClick={() => setModal({ kind: isOrganizer ? "organizers" : "login" })}
            >
              <span className="dot" />
              <span>{isOrganizer ? "Organizer ✓" : "Organizer sign-in"}</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="tabs">
        <div className="tabs-inner">
          {(["standings", "schedule", "teams"] as Tab[]).map((t) => (
            <button key={t} className={"tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </nav>

      <main className="wrap">
        {!state ? (
          <div className="empty">
            <div className="big">{error ? "⚠️" : "⏳"}</div>
            <p>{error ?? "Loading tournament data… if this takes a while, check your connection."}</p>
          </div>
        ) : (
          <>
            {tab === "standings" && <Standings churches={churches} games={games} fixtures={fixtures} />}
            {tab === "schedule" && (
              <Schedule
                churches={churches} games={games} fixtures={fixtures}
                organizerUnlocked={isOrganizer}
                onAdd={() => openFixtureModal(null)}
                onEdit={(f) => openFixtureModal(f)}
                onResult={(f) => setModal({ kind: "result", fixture: f })}
                onLineups={(f) => setModal({ kind: "lineups", fixture: f })}
              />
            )}
            {tab === "teams" && (
              <Teams
                churches={churches} games={games} playersByChurch={playersByChurch}
                organizerUnlocked={isOrganizer}
                churchEmails={churchEmails}
                onAddChurch={() => setModal({ kind: "church" })}
                onEditChurch={(church) => setModal({ kind: "church", church })}
                onAddGame={() => setModal({ kind: "game" })}
                onEditGame={(game) => setModal({ kind: "game", game })}
                onAddPlayer={(churchId) => setModal({ kind: "player", churchId })}
                onEditPlayer={(player) => setModal({ kind: "player", churchId: player.churchId, player })}
              />
            )}
          </>
        )}
        <footer className="note">Live scoreboard — results update automatically. 🏆</footer>
      </main>

      {modal?.kind === "login" && <LoginModal onClose={closeModal} />}
      {modal?.kind === "organizers" && <OrganizersModal onClose={closeModal} />}
      {modal?.kind === "lineups" && (
        <LineupsModal
          fixture={modal.fixture} game={gameById(modal.fixture.gameId)}
          churches={churches} players={state?.players ?? []} publicSheets={state?.teamSheets ?? []}
          organizer={isOrganizer} onClose={closeModal}
        />
      )}
      {isOrganizer && modal?.kind === "fixture" && (
        <FixtureModal fixture={modal.fixture} churches={churches} games={games} onClose={closeModal} />
      )}
      {isOrganizer && modal?.kind === "result" && (
        <ResultModal
          fixture={modal.fixture} game={gameById(modal.fixture.gameId)}
          churchA={churchById(modal.fixture.churchAId)} churchB={churchById(modal.fixture.churchBId)}
          onClose={closeModal}
        />
      )}
      {isOrganizer && modal?.kind === "church" && (
        <ChurchModal church={modal.church} email={modal.church && churchEmails[modal.church.id]} onClose={closeModal} />
      )}
      {isOrganizer && modal?.kind === "player" && (
        <PlayerModal churchId={modal.churchId} player={modal.player} scope="organizer" onClose={closeModal} />
      )}
      {isOrganizer && modal?.kind === "game" && <GameModal game={modal.game} onClose={closeModal} />}
    </>
  );
}
