"use client";

import Link from "next/link";
import { useState } from "react";
import type { GameView } from "@/lib/game/game";
import { Confetti } from "./Confetti";
import { PlayerCards } from "./Lobby";
import { TeamBadge } from "./Logo";

type Act = (path: string, body?: unknown) => Promise<unknown>;

const PLACE_COLORS = ["#f5c542", "#c8d1e6", "#d8935a"];

function Place({ i }: { i: number }) {
  return (
    <span className="w-7 text-center text-lg font-extrabold" style={{ color: PLACE_COLORS[i] ?? "var(--muted)" }}>
      {i + 1}
    </span>
  );
}

export function RoundOver({ view, act }: { view: GameView; act: Act }) {
  const [busy, setBusy] = useState(false);
  const ended = view.phase === "ended";
  const playing = view.teams.filter((t) => t.players.length > 0);
  const round = [...playing].sort((a, b) => b.points - a.points);
  const best = round[0]?.points ?? 0;
  const winners = round.filter((t) => t.points === best && best > 0);
  const lb = view.leaderboard;
  const lbRows = lb?.rows.filter((r) => playing.some((p) => p.team === r.team)) ?? [];
  const champs = ended && lb && lbRows.length ? lbRows.filter((r) => r.wins === lbRows[0].wins && r.points === lbRows[0].points) : null;
  const iWon = winners.some((w) => w.team === view.me.team) || champs?.some((c) => c.team === view.me.team);
  const headline =
    ended && champs
      ? `${champs.map((c) => c.name).join(" & ")} ${champs.length > 1 ? "share the title" : "is the champion"}`
      : winners.length === 0
        ? "No points scored"
        : winners.length > 1
          ? "It's a tie"
          : `${winners[0].name} wins${view.leaderboard ? ` round ${view.round}` : ""}`;
  const hero = (ended && champs ? champs[0] : winners[0]) ?? null;

  return (
    <div className="flex flex-col gap-5 pb-10">
      {iWon && <Confetti pieces={90} />}

      <div className="rise space-y-3 pt-4 text-center">
        <div className="eyebrow !text-gold">{ended ? "Final result" : view.leaderboard ? `Round ${view.round} complete` : "Game over"}</div>
        {hero && (
          <div className="flex justify-center">
            <TeamBadge name={hero.name} color={hero.color} size={64} />
          </div>
        )}
        <h1 className="text-3xl font-extrabold">{headline}</h1>
        {ended && <p className="text-muted">Thanks for playing.</p>}
      </div>

      {!(ended && lb) && (
        <div className="panel space-y-2 p-4">
          <div className="eyebrow">{view.leaderboard ? `Round ${view.round} scores` : "Final scores"}</div>
          {round.map((t, i) => (
            <div key={t.team} className="flex items-center gap-3 rounded-lg px-2 py-2" style={{ background: i === 0 && best > 0 ? "rgba(245,197,66,0.08)" : undefined }}>
              <Place i={i} />
              <TeamBadge name={t.name} color={t.color} size={28} />
              <span className="flex-1 truncate text-lg font-semibold">{t.name}</span>
              <span className="text-2xl font-bold">{t.points}</span>
            </div>
          ))}
        </div>
      )}

      {lb && (
        <div className="panel space-y-3 p-4">
          <div className="eyebrow !text-gold">
            Leaderboard · {lb.rounds} round{lb.rounds === 1 ? "" : "s"}
          </div>
          <div className="grid grid-cols-[1.75rem_1fr_auto_auto] items-center gap-x-3 gap-y-2.5">
            <span />
            <span />
            <span className="eyebrow text-right">Wins</span>
            <span className="eyebrow text-right">Pts</span>
            {lbRows.map((r, i) => (
              <div key={r.team} className="contents">
                <Place i={i} />
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <TeamBadge name={r.name} color={r.color} size={22} />
                  <span className="truncate">{r.name}</span>
                </span>
                <span className="text-right text-xl font-bold text-gold">{r.wins}</span>
                <span className="text-right">{r.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!ended && view.error && <p className="shake rounded-xl border border-bad/50 bg-bad/15 px-4 py-3 text-center">{view.error}</p>}

      {!ended && (
        <details className="panel p-4">
          <summary className="cursor-pointer font-semibold">Change categories</summary>
          <div className="mt-4 space-y-3">
            <PlayerCards view={view} act={act} editable />
          </div>
        </details>
      )}

      {!ended &&
        (view.me.isHost ? (
          <div className="grid gap-3">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await act("start").catch(() => {});
                setBusy(false);
              }}
            >
              {busy ? "Starting…" : view.leaderboard ? `Play round ${view.round + 1}` : "Play again"}
            </button>
            <button className="btn btn-ghost" onClick={() => act("end").catch(() => {})}>
              {view.leaderboard ? "Finish and crown the champion" : "Finish"}
            </button>
          </div>
        ) : (
          <div className="panel p-4 text-center">
            <span className="pulse">Waiting for {view.hostName}…</span>
          </div>
        ))}

      {ended && (
        <Link href="/" className="btn btn-blue">
          Back to start
        </Link>
      )}
    </div>
  );
}
