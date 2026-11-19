"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { DEFAULT_EVENT_NAME, errMessage } from "@/lib/utils";
import type { Church, ChurchRepEmail, Fixture, Game, Player } from "@/lib/types";
import { useTournamentData } from "@/hooks/useTournamentData";
import { useUrlParam } from "@/hooks/useUrlParam";
import { useAuth } from "./Auth";
import { Icon } from "./Icon";
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
const TABS: Tab[] = ["standings", "schedule", "teams"];
const TAB_LABELS: Record<Tab, string> = { standings: "Standings", schedule: "Schedule", teams: "Teams" };

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

  const [tabParam, setTabParam] = useUrlParam("tab", "standings");
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "standings";
  const setTab = (t: Tab) => setTabParam(t);
  const [modal, setModal] = useState<ModalState>(null);
  const closeModal = () => setModal(null);

  const churches = state?.churches ?? [];
  const games = state?.games ?? [];
  const fixtures = state?.fixtures ?? [];
  const eventName = state?.event.name || DEFAULT_EVENT_NAME;
  const gameById = (id: string | null) => games.find((g) => g.id === id);
  const churchById = (id: string) => churches.find((c) => c.id === id);

  // Rep emails aren't public; organizers fetch them separately, again whenever the board changes.
  const [churchEmails, setChurchEmails] = useState<Record<string, ChurchRepEmail[]>>({});
  useEffect(() => {
    if (!isOrganizer) { setChurchEmails({}); return; }
    api<{ id: string; emails: ChurchRepEmail[] }[]>("/api/churches")
      .then((rows) => setChurchEmails(Object.fromEntries(rows.map((r) => [r.id, r.emails]))))
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
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="container bar">
          <div className="event">
            <h1
              key={eventName + String(isOrganizer)}
              className={isOrganizer ? "editable" : undefined}
              contentEditable={isOrganizer}
              suppressContentEditableWarning
              title={isOrganizer ? "Tap to rename the event" : undefined}
              onBlur={(e) => saveEventName(e.currentTarget)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
            >
              {eventName}
            </h1>
            {state?.event.subtitle && <p className="event-sub">{state.event.subtitle}</p>}
          </div>
          <div className="bar-actions">
            <Link className="btn ghost" href="/church">
              {signedInChurch ? signedInChurch.name : "Church portal"}
            </Link>
            <button
              type="button"
              className={"btn ghost" + (isOrganizer ? " is-on" : "")}
              onClick={() => setModal({ kind: isOrganizer ? "organizers" : "login" })}
            >
              {isOrganizer && <Icon name="check" />}
              {isOrganizer ? "Organizer" : "Organizer sign-in"}
            </button>
          </div>
        </div>
        <nav className="tabs" aria-label="Scoreboard">
          <div className="container tabs-row" role="tablist">
            {TABS.map((t) => (
              <button
                key={t} type="button" role="tab" id={`tab-${t}`} aria-controls="main"
                aria-selected={tab === t} className="tab" onClick={() => setTab(t)}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main id="main" className="container wrap" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {!state ? (
          error ? (
            <div className="state-msg" role="alert">
              <Icon name="alert" size={24} />
              <div>
                <p className="state-title">The scoreboard didn&apos;t load</p>
                <p className="muted">{error}. Check your connection; the page reconnects by itself.</p>
              </div>
            </div>
          ) : (
            <div className="skeleton" aria-busy="true" aria-label="Loading the scoreboard">
              {Array.from({ length: 6 }, (_, i) => <span key={i} />)}
            </div>
          )
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
        <footer className="note">Live scoreboard. Results appear here as soon as they are saved.</footer>
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
        <ChurchModal church={modal.church} emails={modal.church && churchEmails[modal.church.id]} onClose={closeModal} />
      )}
      {isOrganizer && modal?.kind === "player" && (
        <PlayerModal churchId={modal.churchId} player={modal.player} scope="organizer" onClose={closeModal} />
      )}
      {isOrganizer && modal?.kind === "game" && <GameModal game={modal.game} onClose={closeModal} />}
    </>
  );
}
