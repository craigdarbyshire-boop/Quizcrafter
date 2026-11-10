"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { GameView } from "@/lib/game/game";
import { CATEGORY_IDEAS, MAX_PLAYERS, MODE_LABELS } from "@/lib/game/types";
import { TeamBadge } from "./Logo";

type Act = (path: string, body?: unknown) => Promise<unknown>;

const AUDIENCE_LABELS: Record<string, string> = { children: "Kids (13 & under)", teens: "Teens (14+)", mixed: "Teens & adults", adults: "Adults", kids: "Teens (14+)", family: "Teens & adults" };

function JoinCode({ code }: { code: string }) {
  const [qr, setQr] = useState("");
  const [link, setLink] = useState("");
  useEffect(() => {
    const url = `${window.location.origin}/join?code=${code}`;
    setLink(url);
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#04071a", light: "#ffffff" } }).then(setQr);
  }, [code]);
  return (
    <div className="panel flex items-center gap-4 p-4">
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code to join" className="h-28 w-28 rounded-xl bg-white p-1" />
      )}
      <div className="min-w-0 flex-1">
        <div className="eyebrow">Game code</div>
        <div className="text-5xl font-extrabold tracking-[0.18em] text-gold">{code}</div>
        <button
          className="mt-1 text-sm font-semibold text-cyan"
          onClick={() => {
            if (navigator.share) navigator.share({ title: "Join my Quizcrafter game", url: link }).catch(() => {});
            else navigator.clipboard?.writeText(link);
          }}
        >
          Share invite link
        </button>
      </div>
    </div>
  );
}

/** Bottom sheet for picking a category. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60 p-4" onClick={onClose}>
      <div className="panel rise mx-auto w-full max-w-md space-y-4 !bg-[#0b1238] p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function CategorySheet({ current, onPick, onClose }: { current: string; onPick: (c: string) => void; onClose: () => void }) {
  const [own, setOwn] = useState("");
  return (
    <Sheet title="Choose your category" onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_IDEAS.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            className={`rounded-xl border px-3.5 py-2 font-semibold ${c === current ? "border-gold bg-gold/15 text-gold" : "border-white/15 bg-black/30"}`}
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
        <input value={own} onChange={(e) => setOwn(e.target.value.slice(0, 40))} placeholder="Or type your own, e.g. Formula 1" className="field w-0 flex-1 !py-2.5 !text-base" />
        <button className="btn btn-blue !px-4 !py-2.5" disabled={!own.trim()}>
          Use
        </button>
      </form>
    </Sheet>
  );
}

/** One card per player. Everyone plays for themselves and picks their own category. */
export function PlayerCards({ view, act, editable }: { view: GameView; act: Act; editable: boolean }) {
  const [picking, setPicking] = useState<number | null>(null);
  const { me } = view;
  const current = view.teams.find((t) => t.team === picking);
  return (
    <>
      <div className="grid gap-2.5">
        {view.teams.map((t) => {
          const mine = me.team === t.team;
          const canEdit = editable && (mine || me.isHost);
          return (
            <div
              key={t.team}
              className="panel rise flex items-center gap-3 px-4 py-3"
              style={{ borderColor: mine ? t.color : undefined, boxShadow: mine ? `0 0 0 1px ${t.color}, 0 10px 30px ${t.color}22` : undefined }}
            >
              <TeamBadge name={t.name} color={t.color} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold">{t.name}</div>
                <button className="text-left text-sm text-muted" disabled={!canEdit} onClick={() => setPicking(t.team)}>
                  {t.category}
                  {canEdit && <span className="text-gold"> · change</span>}
                </button>
              </div>
              {mine && <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold uppercase tracking-wider">You</span>}
            </div>
          );
        })}
      </div>
      {editable && <p className="text-center text-sm text-muted">Everyone plays for themselves. Tap your category to change it.</p>}
      {current && (
        <CategorySheet
          current={current.category}
          onClose={() => setPicking(null)}
          onPick={(c) => {
            act("category", { team: current.team, category: c }).catch(() => {});
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
  const playerCount = view.teams.length;
  return (
    <div className="flex flex-col gap-5 pb-28">
      <JoinCode code={view.code} />
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        {[
          AUDIENCE_LABELS[s.audience ?? "mixed"],
          `${s.questions} questions`,
          `${s.timeLimit}s per question`,
          s.difficulty[0].toUpperCase() + s.difficulty.slice(1),
          s.mode === "mixed" ? "Mixed answer modes" : MODE_LABELS[s.mode],
          s.leaderboard ? "Leaderboard on" : null,
        ]
          .filter(Boolean)
          .map((x) => (
            <span key={x} className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1 text-muted">
              {x}
            </span>
          ))}
      </div>
      {view.error && <p className="shake rounded-xl border border-bad/50 bg-bad/15 px-4 py-3 text-center">{view.error}</p>}
      <div className="eyebrow -mb-2">
        Players · {playerCount} of {MAX_PLAYERS}
      </div>
      <PlayerCards view={view} act={act} editable />
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md bg-gradient-to-t from-[#04071a] via-[#04071a]/90 to-transparent px-4 pb-6 pt-10">
        {view.me.isHost ? (
          <button
            className="btn btn-primary w-full text-lg"
            disabled={starting || playerCount < 1}
            onClick={async () => {
              setStarting(true);
              await act("start").catch(() => {});
              setStarting(false);
            }}
          >
            {starting ? "Starting…" : `Start game · ${playerCount} player${playerCount === 1 ? "" : "s"}`}
          </button>
        ) : (
          <div className="panel p-4 text-center">
            <span className="pulse">Waiting for {view.hostName} to start…</span>
          </div>
        )}
      </div>
    </div>
  );
}
