"use client";

import Link from "next/link";
import { useState } from "react";
import type { GameView } from "@/lib/game/game";
import { Confetti } from "./Confetti";
import { TeamCards } from "./Lobby";

type Act = (path: string, body?: unknown) => Promise<unknown>;

const MEDALS = ["🥇", "🥈", "🥉"];

export function RoundOver({ view, act }: { view: GameView; act: Act }) {
  const [busy, setBusy] = useState(false);
  const ended = view.phase === "ended";
  const playing = view.teams.filter((t) => t.players.length > 0);
  const round = [...playing].sort((a, b) => b.points - a.points);
  const best = round[0]?.points ?? 0;
  const winners = round.filter((t) => t.points === best && best > 0);
  const lb = view.leaderboard;
  const champs = ended && lb ? lb.rows.filter((r) => r.wins === lb.rows[0].wins && r.points === lb.rows[0].points) : null;
  const iWon = winners.some((w) => w.team === view.me.team) || champs?.some((c) => c.team === view.me.team);

  return (
    <div className="flex flex-col gap-5 pb-10">
      {iWon && <Confetti pieces={120} />}

      <div className="pop text-center">
        <div className="bounce text-7xl">{ended && champs ? champs[0].emoji : winners[0]?.emoji ?? "🤝"}</div>
        <h1 className="mt-2 text-4xl font-bold">
          {ended && champs
            ? `${champs.map((c) => c.name).join(" & ")} ${champs.length > 1 ? "are" : "is"} the champion${champs.length > 1 ? "s" : ""}!`
            : winners.length === 0
              ? "No points this round!"
              : winners.length > 1
                ? "It's a tie!"
                : `${winners[0].name} win${view.leaderboard ? ` round ${view.round}` : ""}!`}
        </h1>
        {ended && <p className="mt-1 text-muted">Thanks for playing! 👋</p>}
      </div>

      {!(ended && lb) && (
        <div className="card space-y-3 p-4">
          <div className="text-sm font-semibold uppercase tracking-wider text-muted">{view.leaderboard ? `Round ${view.round} scores` : "Final scores"}</div>
          {round.map((t, i) => (
            <div key={t.team} className="flex items-center gap-3 rounded-2xl px-3 py-2" style={{ background: `${t.color}26` }}>
              <span className="w-8 text-2xl">{MEDALS[i] ?? i + 1}</span>
              <span className="text-2xl">{t.emoji}</span>
              <span className="flex-1 text-lg font-semibold">{t.name}</span>
              <span className="text-2xl font-bold">{t.points}</span>
            </div>
          ))}
        </div>
      )}

      {lb && (
        <div className="card space-y-3 p-4">
          <div className="text-sm font-semibold uppercase tracking-wider text-yellow">
            🏆 Leaderboard · {lb.rounds} round{lb.rounds === 1 ? "" : "s"}
          </div>
          <div className="grid grid-cols-[2rem_1fr_auto_auto] items-center gap-x-3 gap-y-2">
            <span />
            <span />
            <span className="text-right text-xs text-muted">WINS</span>
            <span className="text-right text-xs text-muted">POINTS</span>
            {lb.rows
              .filter((r) => playing.some((p) => p.team === r.team))
              .map((r, i) => (
                <div key={r.team} className="contents">
                  <span className="text-xl">{MEDALS[i] ?? i + 1}</span>
                  <span className="truncate text-lg font-semibold">
                    {r.emoji} {r.name}
                  </span>
                  <span className="text-right text-xl font-bold text-yellow">{r.wins}</span>
                  <span className="text-right text-lg">{r.points}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {!ended && view.error && <p className="wiggle rounded-2xl bg-coral/25 px-4 py-3 text-center">{view.error}</p>}

      {!ended && view.leaderboard && (
        <details className="card p-4">
          <summary className="cursor-pointer font-semibold">Change teams or categories for the next round</summary>
          <div className="mt-4 space-y-3">
            <TeamCards view={view} act={act} editable />
          </div>
        </details>
      )}

      {!ended &&
        (view.me.isHost ? (
          <div className="grid gap-3">
            <button
              className="btn btn-primary text-xl"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await act("start").catch(() => {});
                setBusy(false);
              }}
            >
              {busy ? "Starting…" : view.leaderboard ? `Play round ${view.round + 1}! 🔁` : "Play again! 🔁"}
            </button>
            <button className="btn btn-ghost" onClick={() => act("end").catch(() => {})}>
              {view.leaderboard ? "Finish and crown the champions 👑" : "Finish"}
            </button>
          </div>
        ) : (
          <div className="card p-4 text-center">
            Waiting for <b>{view.hostName}</b>… <span className="bounce inline-block">⏳</span>
          </div>
        ))}

      {ended && (
        <Link href="/" className="btn btn-pink">
          Back to the start
        </Link>
      )}
    </div>
  );
}
