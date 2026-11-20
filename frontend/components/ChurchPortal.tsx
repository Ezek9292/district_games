"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { FORMATS, fixtureChurchIds, isRace, ordinal, placePoints } from "@/lib/formats";
import type { Fixture, Player, TeamSheet } from "@/lib/types";
import { useTournamentData } from "@/hooks/useTournamentData";
import { useAuth } from "./Auth";
import { ChurchChip } from "./ChurchChip";
import { Icon } from "./Icon";
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
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="container bar">
          <div className="event">
            <h1>{church ? church.name : "Church Portal"}</h1>
            <p className="event-sub">Team registration and team sheets</p>
          </div>
          <div className="bar-actions">
            <Link className="btn ghost" href="/"><Icon name="back" />Scoreboard</Link>
            {church && (
              <button type="button" className="btn ghost" onClick={() => signOut("church")}><Icon name="out" />Sign out</button>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="container wrap">
        {!ready ? (
          <div className="skeleton" aria-busy="true" aria-label="Loading">
            {Array.from({ length: 4 }, (_, i) => <span key={i} />)}
          </div>
        ) : !church ? (
          <div className="signin">
            <h2>Church sign-in</h2>
            <SignInForm
              as="church"
              intro="Enter your church's registered rep email or phone number and we'll send you a 6-digit code. Not registered? Ask an organizer to add your email or number to your church."
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
    return error ? (
      <div className="state-msg" role="alert">
        <Icon name="alert" size={24} />
        <div>
          <p className="state-title">Your church&apos;s page didn&apos;t load</p>
          <p className="muted">{error}. Check your connection; the page reconnects by itself.</p>
        </div>
      </div>
    ) : (
      <div className="skeleton" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 4 }, (_, i) => <span key={i} />)}
      </div>
    );
  }

  const church = state.churches.find((c) => c.id === churchId);
  const players = playersByChurch[churchId] ?? [];
  const gameById = (id: string | null) => state.games.find((g) => g.id === id);
  const churchById = (id: string) => state.churches.find((c) => c.id === id);
  const myFixtures = state.fixtures.filter((f) => fixtureChurchIds(f).includes(churchId));
  const opponentOf = (f: Fixture) => {
    const id = f.churchAId === churchId ? f.churchBId : f.churchAId;
    return id ? churchById(id) : undefined;
  };
  const playerName = (id: string | undefined) => players.find((p) => p.id === id)?.name ?? "";
  const upcoming = myFixtures.filter((f) => f.status === "scheduled");
  const played = myFixtures.filter((f) => f.status === "final");
  const sheetFor = (fixtureId: string) => sheets.find((s) => s.fixtureId === fixtureId);
  const count = (pred: (p: Player) => boolean) => players.filter(pred).length;

  return (
    <>
      {church && (
        <dl className="stats" aria-label="Your squad">
          <div><dt>Registered</dt><dd>{players.length}</dd></div>
          <div><dt>Men</dt><dd>{count((p) => p.gender === "male")}</dd></div>
          <div><dt>Women</dt><dd>{count((p) => p.gender === "female")}</dd></div>
          <div><dt>Elders</dt><dd>{count((p) => p.isElder)}</dd></div>
        </dl>
      )}

      <section className="block" aria-labelledby="upcoming-head">
        <div className="section-head"><h2 id="upcoming-head">Upcoming Games</h2></div>
        {!upcoming.length ? (
          <p className="muted">No upcoming fixtures yet. They&apos;ll appear here once the organizers set the schedule.</p>
        ) : (
          <ul className="fixtures">
            {upcoming.map((f) => {
              const game = gameById(f.gameId);
              const race = isRace(game);
              const opponent = opponentOf(f);
              const sheet = sheetFor(f.id);
              const starterRows = sheet?.players.filter((p) => p.role === "starter") ?? [];
              const starters = starterRows.length;
              const subs = sheet ? sheet.players.length - starters : 0;
              const single = game ? FORMATS[game.format].starters === 1 : false;
              return (
                <li key={f.id} className="fixture">
                  <div className="fx-when">
                    <span className="fx-time">{f.time || "Time to be set"}</span>
                    <span className="fx-game">{game?.name ?? "No game set"}</span>
                    {f.round && <span className="muted">{f.round}</span>}
                    {f.location && <span className="muted">{f.location}</span>}
                  </div>
                  <div className="fx-teams">
                    <div className="fx-side">
                      {race ? (
                        <span className="muted">All churches together: {f.entries.length} entered</span>
                      ) : (
                        <>
                          <span className="muted fx-vs">vs</span>
                          {opponent ? <ChurchChip church={opponent} /> : <span className="muted">To be decided</span>}
                        </>
                      )}
                    </div>
                    <p className={"fx-status" + (sheet ? " ok" : " todo")}>
                      {sheet
                        ? <><Icon name="check" size={16} />{single
                          ? <>Your player: {playerName(starterRows[0]?.playerId)}{subs ? ", plus a reserve" : ""}</>
                          : <>Team sheet saved: {starters} starting, {subs} on the bench</>}</>
                        : single ? "No player picked yet" : "No team sheet yet"}
                    </p>
                  </div>
                  <div className="fx-actions">
                    <button
                      type="button"
                      className={"btn " + (sheet ? "" : "accent")}
                      onClick={() => game ? setModal({ kind: "sheet", fixture: f }) : toast("This fixture has no game yet.")}
                    >
                      {single ? (sheet ? "Change player" : "Pick player") : sheet ? "Edit team sheet" : "Pick team"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="block" aria-labelledby="players-head">
        <div className="section-head">
          <h2 id="players-head">Registered Players</h2>
          <button type="button" className="btn" onClick={() => setModal({ kind: "player" })}><Icon name="plus" />Register player</button>
        </div>
        <p className="muted intro">
          Register everyone once, then pick from them for each game. Tap a player to see their profile, or the camera to change their photo.
        </p>
        <p className="muted intro">
          Team sizes: {Object.values(FORMATS).filter((r) => r.starters > 1).map((r) => `${r.label} ${r.starters} + ${r.maxSubs}`).join(", ")}.
          Table tennis, draughts and the all-church events (100 metres, sack race, lime and spoon, ludo) take 1 player plus 1 reserve.
        </p>
        {!players.length ? (
          <div className="empty">
            <p className="state-title">No players yet</p>
            <p className="muted">Register your first player to start picking team sheets.</p>
          </div>
        ) : (
          <ul className="player-grid">
            {players.map((p) => (
              <li key={p.id}>
                <PlayerCard player={p} church={church} scope="church" onEdit={() => setModal({ kind: "player", player: p })} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {played.length > 0 && (
        <section className="block" aria-labelledby="played-head">
          <div className="section-head"><h2 id="played-head">Played</h2></div>
          <ul className="fixtures">
            {played.map((f) => {
              const game = gameById(f.gameId);
              if (isRace(game) || f.entries.length) {
                const place = f.entries.find((e) => e.churchId === churchId)?.place ?? null;
                return (
                  <li key={f.id} className="fixture">
                    <div className="fx-when">
                      <span className="fx-game">{game?.name ?? "No game set"}</span>
                      {f.round && <span className="muted">{f.round}</span>}
                    </div>
                    <div className="fx-teams">
                      <div className="fx-side">
                        <span className={"place-badge" + (place && place <= 3 ? ` p${place}` : "")}>{place ? ordinal(place) : "DNF"}</span>
                        <span className="muted">of {f.entries.length} churches, {placePoints(game, place)} {placePoints(game, place) === 1 ? "pt" : "pts"}</span>
                      </div>
                    </div>
                    <div className="fx-actions">
                      <button type="button" className="btn ghost sm" onClick={() => setModal({ kind: "lineups", fixture: f })}>Competitors</button>
                    </div>
                  </li>
                );
              }
              const mine = f.churchAId === churchId;
              const opponent = opponentOf(f);
              const [us, them] = mine ? [f.scoreA, f.scoreB] : [f.scoreB, f.scoreA];
              const result = f.outcome === "draw" ? "D" : (f.outcome === "A") === mine ? "W" : "L";
              const resultWord = { W: "Won", D: "Drew", L: "Lost" }[result];
              return (
                <li key={f.id} className="fixture">
                  <div className="fx-when">
                    <span className="fx-game">{gameById(f.gameId)?.name ?? "No game set"}</span>
                    {f.round && <span className="muted">{f.round}</span>}
                  </div>
                  <div className="fx-teams">
                    <div className="fx-side">
                      <span className={"result-badge r-" + result} aria-label={resultWord}>{result}</span>
                      <span className="fx-score">{us}:{them}</span>
                      <span className="muted fx-vs">vs</span>
                      {opponent && <ChurchChip church={opponent} />}
                    </div>
                  </div>
                  <div className="fx-actions">
                    <button type="button" className="btn ghost sm" onClick={() => setModal({ kind: "lineups", fixture: f })}>Line-ups</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {modal?.kind === "player" && (
        <PlayerModal churchId={churchId} scope="church" player={modal.player} onClose={closeModal} />
      )}
      {modal?.kind === "sheet" && gameById(modal.fixture.gameId) && (
        <TeamSheetModal
          fixture={modal.fixture}
          game={gameById(modal.fixture.gameId)!}
          opponent={opponentOf(modal.fixture)}
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
