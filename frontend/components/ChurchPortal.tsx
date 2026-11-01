"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { FORMATS } from "@/lib/formats";
import { luminanceTextColor } from "@/lib/utils";
import type { Fixture, Player, TeamSheet } from "@/lib/types";
import { useTournamentData } from "@/hooks/useTournamentData";
import { useAuth } from "./Auth";
import { ChurchChip } from "./ChurchChip";
import { PlayerCard } from "./PlayerCard";
import { SignInForm } from "./SignInForm";
import { useToast } from "./Toast";
import { PlayerModal } from "./modals/PlayerModal";
import { TeamSheetModal } from "./modals/TeamSheetModal";
import { LineupsModal } from "./modals/LineupsModal";

type ModalState =
  | null
  | { kind: "player"; player?: Player }
  | { kind: "sheet"; fixture: Fixture }
  | { kind: "lineups"; fixture: Fixture };

export default function ChurchPortal() {
  const { ready, church, signOut } = useAuth();

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            <h1>{church ? church.name : "Church Portal"}</h1>
            <span className="sub">Team registration &amp; team sheets</span>
          </div>
          <div className="header-actions">
            <Link className="org-toggle" href="/">‹ Scoreboard</Link>
            {church && <button className="org-toggle" onClick={() => signOut("church")}>Sign out</button>}
          </div>
        </div>
      </header>
      <main className="wrap portal-main">
        {!ready ? (
          <div className="empty"><div className="big">⏳</div><p>Loading…</p></div>
        ) : !church ? (
          <div className="card narrow-card">
            <h3 className="card-title">Church sign-in</h3>
            <SignInForm
              as="church"
              intro="Enter your church's registered rep email and we'll send you a 6-digit code. Don't have one? Ask an organizer to add your email to your church."
            />
          </div>
        ) : (
          <SignedInPortal churchId={church.id} />
        )}
      </main>
    </>
  );
}

function SignedInPortal({ churchId }: { churchId: string }) {
  const toast = useToast();
  const { state, error, playersByChurch } = useTournamentData();
  const [sheets, setSheets] = useState<TeamSheet[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const closeModal = () => setModal(null);

  // Our own sheets (including unplayed games) aren't in the public state.
  useEffect(() => {
    api<TeamSheet[]>("/api/church/sheets").then(setSheets).catch(() => {});
  }, [state]);

  if (!state) {
    return <div className="empty"><div className="big">{error ? "⚠️" : "⏳"}</div><p>{error ?? "Loading…"}</p></div>;
  }

  const church = state.churches.find((c) => c.id === churchId);
  const players = playersByChurch[churchId] ?? [];
  const gameById = (id: string | null) => state.games.find((g) => g.id === id);
  const churchById = (id: string) => state.churches.find((c) => c.id === id);
  const myFixtures = state.fixtures.filter((f) => f.churchAId === churchId || f.churchBId === churchId);
  const upcoming = myFixtures.filter((f) => f.status === "scheduled");
  const played = myFixtures.filter((f) => f.status === "final");
  const sheetFor = (fixtureId: string) => sheets.find((s) => s.fixtureId === fixtureId);
  const count = (pred: (p: Player) => boolean) => players.filter(pred).length;

  return (
    <>
      {church && (
        <div className="portal-banner" style={{ background: church.color, color: luminanceTextColor(church.color) }}>
          <strong>{players.length}</strong> registered · {count((p) => p.gender === "male")} men · {count((p) => p.gender === "female")} women · {count((p) => p.isElder)} elders
        </div>
      )}

      <section style={{ marginBottom: 34 }}>
        <div className="section-head"><h2>Upcoming Games</h2></div>
        {!upcoming.length ? (
          <div className="card"><p className="muted" style={{ padding: 16, margin: 0 }}>No upcoming fixtures yet. They&apos;ll appear here once the organizers set the schedule.</p></div>
        ) : (
          <div className="card">
            {upcoming.map((f) => {
              const game = gameById(f.gameId);
              const opponent = churchById(f.churchAId === churchId ? f.churchBId : f.churchAId);
              const sheet = sheetFor(f.id);
              const starters = sheet?.players.filter((p) => p.role === "starter").length ?? 0;
              const subs = sheet ? sheet.players.length - starters : 0;
              return (
                <div key={f.id} className="fixture">
                  <div className="fx-teams">
                    <span className="fx-vs">vs</span>
                    {opponent ? <ChurchChip church={opponent} /> : <span className="muted">TBD</span>}
                  </div>
                  <div className="fx-meta">
                    <span className="fx-game">{game?.name ?? "—"}</span>
                    <br />{f.round}{f.time && ` · ${f.time}`}{f.location && ` · ${f.location}`}
                  </div>
                  <span className={"fx-status " + (sheet ? "final" : "scheduled")}>
                    {sheet ? `Sheet ✓ ${starters} + ${subs}` : "No team sheet"}
                  </span>
                  <div className="fx-actions">
                    <button
                      className={"btn sm " + (sheet ? "ghost" : "accent")}
                      onClick={() => game ? setModal({ kind: "sheet", fixture: f }) : toast("This fixture has no game yet.")}
                    >
                      {sheet ? "Edit team sheet" : "Pick team"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 34 }}>
        <div className="section-head">
          <h2>Registered Players</h2>
          <button className="btn accent" onClick={() => setModal({ kind: "player" })}>+ Register Player</button>
        </div>
        <p className="muted" style={{ marginTop: -6 }}>
          Register everyone once; then pick from them for each game. Tap a photo to change it.
          Team sheets: {Object.values(FORMATS).map((r) => `${r.label} ${r.starters} + ${r.maxSubs}`).join(" · ")}.
        </p>
        <div className="card team-body">
          {!players.length ? (
            <p className="muted" style={{ margin: 0 }}>No players yet. Tap &quot;+ Register Player&quot; to add your first.</p>
          ) : (
            <div className="player-grid">
              {players.map((p) => (
                <PlayerCard key={p.id} player={p} scope="church" onEdit={() => setModal({ kind: "player", player: p })} />
              ))}
            </div>
          )}
        </div>
      </section>

      {played.length > 0 && (
        <section>
          <div className="section-head"><h2>Played</h2></div>
          <div className="card">
            {played.map((f) => {
              const mine = f.churchAId === churchId;
              const opponent = churchById(mine ? f.churchBId : f.churchAId);
              const [us, them] = mine ? [f.scoreA, f.scoreB] : [f.scoreB, f.scoreA];
              const result = f.outcome === "draw" ? "D" : (f.outcome === "A") === mine ? "W" : "L";
              return (
                <div key={f.id} className="fixture">
                  <div className="fx-teams">
                    <span className={"result-badge r-" + result}>{result}</span>
                    <span className="fx-score">{us} – {them}</span>
                    <span className="fx-vs">vs</span>
                    {opponent && <ChurchChip church={opponent} />}
                  </div>
                  <div className="fx-meta"><span className="fx-game">{gameById(f.gameId)?.name ?? "—"}</span></div>
                  <div className="fx-actions">
                    <button className="btn ghost sm" onClick={() => setModal({ kind: "lineups", fixture: f })}>Line-ups</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {modal?.kind === "player" && (
        <PlayerModal churchId={churchId} scope="church" player={modal.player} onClose={closeModal} />
      )}
      {modal?.kind === "sheet" && gameById(modal.fixture.gameId) && (
        <TeamSheetModal
          fixture={modal.fixture}
          game={gameById(modal.fixture.gameId)!}
          opponent={churchById(modal.fixture.churchAId === churchId ? modal.fixture.churchBId : modal.fixture.churchAId)}
          players={players}
          sheet={sheetFor(modal.fixture.id)}
          onClose={closeModal}
        />
      )}
      {modal?.kind === "lineups" && (
        <LineupsModal
          fixture={modal.fixture} game={gameById(modal.fixture.gameId)}
          churches={state.churches} players={state.players} publicSheets={state.teamSheets}
          organizer={false} onClose={closeModal}
        />
      )}
    </>
  );
}
