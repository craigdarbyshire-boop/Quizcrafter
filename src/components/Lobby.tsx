"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { GameView } from "@/lib/game/game";
import { CATEGORY_IDEAS } from "@/lib/game/types";

type Act = (path: string, body?: unknown) => Promise<unknown>;

function JoinCode({ code }: { code: string }) {
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  useEffect(() => {
    const url = `${window.location.origin}/join?code=${code}`;
    setLink(url);
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#170b45", light: "#ffffff" } }).then(setQr);
  }, [code]);
  return (
    <div className="card flex items-center gap-4 p-4">
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code to join" className="h-28 w-28 rounded-2xl bg-white p-1" />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm text-muted">Join at this link or scan me</div>
        <div className="text-5xl font-bold tracking-[0.2em] text-yellow">{code}</div>
        <button
          className="mt-1 truncate text-left text-sm text-sky underline"
          onClick={() => {
            if (navigator.share) navigator.share({ title: "Join my Quizcrafter game!", url: link }).catch(() => {});
            else navigator.clipboard?.writeText(link);
          }}
        >
          Share link
        </button>
      </div>
    </div>
  );
}

function CategoryPicker({ current, onPick, onClose }: { current: string; onPick: (c: string) => void; onClose: () => void }) {
  const [own, setOwn] = useState("");
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/50 p-4" onClick={onClose}>
      <div className="card pop mx-auto w-full max-w-md space-y-4 !bg-[#1d0f55] p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold">Pick your category</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_IDEAS.map((c) => (
            <button
              key={c}
              onClick={() => onPick(c)}
              className={`rounded-full border-2 px-4 py-2 font-semibold ${c === current ? "border-yellow bg-yellow text-[#3a1d00]" : "border-white/25 bg-white/10"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (own.trim()) onPick(own.trim());
          }}
        >
          <input
            value={own}
            onChange={(e) => setOwn(e.target.value.slice(0, 40))}
            placeholder="Or type your own… (e.g. Dinosaurs)"
            className="w-0 flex-1 rounded-full border-2 border-white/25 bg-white/10 px-4 py-2 placeholder:text-white/40 focus:border-yellow focus:outline-none"
          />
          <button className="btn btn-pink !px-4 !py-2" disabled={!own.trim()}>
            Use
          </button>
        </form>
      </div>
    </div>
  );
}

export function TeamCards({ view, act, editable }: { view: GameView; act: Act; editable: boolean }) {
  const [picking, setPicking] = useState<number | null>(null);
  const { me } = view;
  return (
    <>
      <div className="grid gap-3">
        {view.teams.map((t) => {
          const mine = me.team === t.team;
          const canPick = editable && (mine || me.isHost);
          return (
            <div
              key={t.team}
              className="card overflow-hidden p-0 transition"
              style={{ borderColor: mine ? t.color : undefined, boxShadow: mine ? `0 0 24px ${t.color}66` : undefined }}
            >
              <div className="flex items-center gap-3 px-4 py-3" style={{ background: `${t.color}33` }}>
                <span className="text-3xl">{t.emoji}</span>
                <div className="flex-1">
                  <div className="text-xl font-bold">{t.name}</div>
                  <button
                    className={`text-sm ${canPick ? "text-yellow underline" : "text-muted"}`}
                    disabled={!canPick}
                    onClick={() => setPicking(t.team)}
                  >
                    📚 {t.category}
                    {canPick ? " · change" : ""}
                  </button>
                </div>
                {editable && !mine && (
                  <button className="btn btn-ghost !px-3 !py-1.5 text-sm" onClick={() => act("team", { team: t.team })}>
                    Join
                  </button>
                )}
                {mine && <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">You</span>}
              </div>
              <div className="flex min-h-12 flex-wrap gap-2 px-4 py-3">
                {t.players.length === 0 && <span className="text-sm text-muted">Waiting for players…</span>}
                {t.players.map((p) => (
                  <button
                    key={p.id}
                    disabled={!editable || !me.isHost}
                    title={me.isHost ? "Tap to move to the next team" : undefined}
                    onClick={() => act("team", { playerId: p.id, team: (t.team + 1) % view.teams.length })}
                    className="pop rounded-full bg-white/15 px-3 py-1 font-semibold"
                  >
                    {p.name}
                    {p.id === me.id ? " (you)" : ""}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {editable && me.isHost && <p className="text-center text-sm text-muted">Tip: tap a player to move them to another team.</p>}
      {picking !== null && (
        <CategoryPicker
          current={view.teams[picking].category}
          onClose={() => setPicking(null)}
          onPick={(c) => {
            act("category", { team: picking, category: c }).catch(() => {});
            setPicking(null);
          }}
        />
      )}
    </>
  );
}

export function Lobby({ view, act }: { view: GameView; act: Act }) {
  const [starting, setStarting] = useState(false);
  const s = view.settings;
  const playerCount = view.teams.reduce((n, t) => n + t.players.length, 0);
  return (
    <div className="flex flex-col gap-5 pb-28">
      <JoinCode code={view.code} />
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        {[
          `${s.questions} questions`,
          `${s.timeLimit}s each`,
          { easy: "😊 Easy", medium: "🤔 Medium", hard: "🔥 Hard" }[s.difficulty],
          s.mode === "fastest" ? "⚡ Fastest first" : "🤫 Silent answers",
          s.leaderboard ? "🏆 Leaderboard" : null,
        ]
          .filter(Boolean)
          .map((x) => (
            <span key={x} className="rounded-full bg-white/10 px-3 py-1">
              {x}
            </span>
          ))}
      </div>
      {view.error && <p className="wiggle rounded-2xl bg-coral/25 px-4 py-3 text-center">{view.error}</p>}
      <TeamCards view={view} act={act} editable />
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md bg-gradient-to-t from-[#2a0f6b] via-[#2a0f6b]/90 to-transparent px-4 pb-6 pt-10">
        {view.me.isHost ? (
          <button
            className="btn btn-primary w-full text-xl"
            disabled={starting || playerCount < 1}
            onClick={async () => {
              setStarting(true);
              await act("start").catch(() => {});
              setStarting(false);
            }}
          >
            {starting ? "Starting…" : `Start the game! (${playerCount} playing)`}
          </button>
        ) : (
          <div className="card p-4 text-center text-lg">
            Waiting for <b>{view.hostName}</b> to start… <span className="bounce inline-block">⏳</span>
          </div>
        )}
      </div>
    </div>
  );
}
