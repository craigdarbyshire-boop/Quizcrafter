"use client";

import { useEffect, useState } from "react";
import type { GameView } from "@/lib/game/game";
import { MODE_LABELS } from "@/lib/game/types";
import { TeamBadge } from "./Logo";

type Act = (path: string, body?: unknown) => Promise<unknown>;

function useNow(now: () => number, ms = 100) {
  const [t, setT] = useState(now());
  useEffect(() => {
    const id = setInterval(() => setT(now()), ms);
    return () => clearInterval(id);
  }, [now, ms]);
  return t;
}

function Timer({ endsAt, total, now }: { endsAt: number; total: number; now: number }) {
  const left = Math.max(0, endsAt - now);
  const frac = Math.min(1, left / (total * 1000));
  const secs = Math.ceil(left / 1000);
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = frac > 0.5 ? "#3fd2ff" : frac > 0.25 ? "#f5c542" : "#ff4d5e";
  return (
    <div className="relative h-16 w-16">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="rgba(255,255,255,0.12)" strokeWidth="5" fill="#000" />
        <circle cx="32" cy="32" r={r} stroke={color} strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      </svg>
      <div className={`absolute inset-0 grid place-items-center text-2xl font-bold ${secs <= 3 ? "pulse" : ""}`} style={{ color }}>
        {secs}
      </div>
    </div>
  );
}

export function QuestionScreen({ view, act, now }: { view: GameView; act: Act; now: () => number }) {
  const q = view.question!;
  const t = useNow(now);
  const revealing = view.phase === "reveal";
  const [typed, setTyped] = useState("");
  const [sending, setSending] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const myTeam = view.teams[view.me.team];
  const pickedBy = view.teams[q.pickedBy];
  const locked = !!view.mine || sending;
  const fastest = q.mode === "fastest";
  const mixed = view.settings.mode === "mixed";

  async function answer(a: string) {
    if (locked || revealing || !a.trim()) return;
    setPicked(a);
    setSending(true);
    try {
      await act("answer", { answer: a });
    } catch {
      setPicked(null);
    } finally {
      setSending(false);
    }
  }

  const chosen = view.mine?.answer ?? picked;
  const isAnswer = (o: string) => revealing && q.answer?.toLowerCase() === o.toLowerCase();

  return (
    <div className="flex flex-1 flex-col gap-4 pb-6">
      <div className="flex items-center gap-3">
        {revealing ? (
          <div className={`rise grid h-16 w-16 place-items-center rounded-full border-2 text-3xl font-bold ${view.mine?.correct ? "border-good text-good" : "border-white/20 text-muted"}`}>
            {view.mine?.correct ? "✓" : "–"}
          </div>
        ) : (
          <Timer endsAt={q.endsAt} total={view.settings.timeLimit} now={t} />
        )}
        <div className="min-w-0 flex-1">
          <div className="eyebrow">
            Question {q.index + 1} / {q.total}
            {view.round > 1 ? ` · Round ${view.round}` : ""}
          </div>
          <div className="flex items-center gap-2 truncate font-semibold">
            {pickedBy && <TeamBadge name={pickedBy.name} color={pickedBy.color} size={18} />}
            <span className="truncate">{q.category}</span>
          </div>
        </div>
        <div className="rounded-xl border border-gold/60 px-3 py-1.5 text-center leading-tight">
          <div className="text-xl font-bold text-gold">{q.points}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">pts</div>
        </div>
      </div>

      {mixed && (
        <div
          key={q.index}
          className={`rise flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${fastest ? "border-gold/70 bg-gold/10 text-gold" : "border-white/15 bg-black/30"}`}
        >
          <span className="uppercase tracking-wider">{MODE_LABELS[q.mode]}</span>
          <span className="font-normal text-muted">· {fastest ? "first correct answer wins" : "one answer per team"}</span>
        </div>
      )}

      <div className="question-card rise px-5 py-9 text-center">
        <h1 className="text-[1.6rem] font-bold leading-snug">{q.text}</h1>
      </div>

      {q.type === "typed" ? (
        <div className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              answer(typed);
            }}
          >
            <input
              value={view.mine?.answer ?? typed}
              onChange={(e) => setTyped(e.target.value.slice(0, 100))}
              disabled={locked || revealing}
              placeholder="Type your answer"
              autoComplete="off"
              className={`field w-0 flex-1 !py-4 font-semibold ${revealing && view.mine && !view.mine.correct ? "!border-bad" : ""}`}
            />
            <button className="btn btn-primary" disabled={locked || revealing || !typed.trim()}>
              Submit
            </button>
          </form>
          {revealing && q.answer && (
            <div className="rise rounded-xl border border-good bg-good/15 px-4 py-3 text-center text-lg font-bold">Answer: {q.answer}</div>
          )}
        </div>
      ) : (
        <div className={`grid gap-3 ${q.type === "true_false" ? "grid-cols-2" : "grid-cols-1"}`}>
          {q.options.map((o, i) => {
            const right = isAnswer(o);
            const mineHere = chosen === o;
            const dim = (revealing && !right && !mineHere) || (!revealing && locked && !mineHere);
            const cls = ["answer-tile", right ? "is-right rise" : "", mineHere && !right ? (revealing ? "is-wrong" : "is-picked") : "", q.type === "true_false" ? "!min-h-24 !pl-4 text-center !text-xl" : ""].join(" ");
            return (
              <button key={o} disabled={locked || revealing} onClick={() => answer(o)} className={cls} style={{ opacity: dim ? 0.35 : 1 }}>
                {q.type !== "true_false" && <span className="badge">{"ABCD"[i]}</span>}
                {o}
                {right && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold">✓</span>}
              </button>
            );
          })}
        </div>
      )}

      <StatusLine view={view} myTeamName={myTeam?.name ?? "Your team"} fastest={fastest} />

      {revealing && <Reveal view={view} act={act} now={t} />}
    </div>
  );
}

function StatusLine({ view, myTeamName, fastest }: { view: GameView; myTeamName: string; fastest: boolean }) {
  const q = view.question!;
  const revealing = view.phase === "reveal";
  const mine = view.mine;
  let text: string;
  if (revealing) {
    if (!mine) text = fastest ? "You didn't answer." : `${myTeamName} didn't answer in time.`;
    else if (mine.correct) text = fastest && q.winner?.playerId !== view.me.id ? "Correct, but someone was faster." : `Correct! +${q.points} to ${myTeamName}`;
    else text = "Wrong answer.";
  } else if (mine) {
    if (fastest) text = mine.correct ? "Correct!" : "Wrong. You're locked out of this question.";
    else text = `${myTeamName} locked in${mine.by && mine.by !== view.me.name ? ` (by ${mine.by})` : ""}. Waiting for other teams…`;
  } else {
    text = fastest ? "First correct answer wins." : `One answer for ${myTeamName}. Agree on it together.`;
  }
  const active = view.teams.filter((t) => t.players.length > 0);
  return (
    <div className="space-y-2.5 text-center">
      <p className={`font-semibold ${revealing ? "rise" : "text-muted"} ${revealing && mine?.correct ? "!text-good" : ""}`}>{text}</p>
      {!revealing && !fastest && (
        <div className="flex flex-wrap justify-center gap-2">
          {active.map((t) => {
            const done = q.answeredTeams.includes(t.team);
            return (
              <span
                key={t.team}
                className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition"
                style={{ borderColor: done ? t.color : "rgba(255,255,255,0.12)", color: done ? t.color : "var(--muted)" }}
              >
                {t.name} {done ? "✓" : "…"}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Reveal({ view, act, now }: { view: GameView; act: Act; now: number }) {
  const q = view.question!;
  const nextIn = view.revealEndsAt ? Math.max(0, Math.ceil((view.revealEndsAt - now) / 1000)) : 0;
  const last = q.index + 1 >= q.total;
  const sorted = [...view.teams].filter((t) => t.players.length > 0).sort((a, b) => b.points - a.points);
  const winnerTeam = q.winner ? view.teams[q.winner.team] : null;
  return (
    <div className="space-y-3">
      {q.winner && winnerTeam && (
        <div className="rise panel p-3 text-center">
          Fastest: <b>{q.winner.name}</b> <span className="text-muted">({winnerTeam.name})</span>
        </div>
      )}
      {q.funFact && (
        <div className="rise panel p-4">
          <div className="eyebrow !text-gold">Did you know?</div>
          <p className="mt-1 text-[0.95rem]">{q.funFact}</p>
        </div>
      )}
      <div className="panel space-y-2 p-4">
        {sorted.map((t, i) => (
          <div key={t.team} className="flex items-center gap-3">
            <span className="w-5 text-center font-bold text-muted">{i + 1}</span>
            <TeamBadge name={t.name} color={t.color} size={24} />
            <span className="flex-1 truncate font-semibold">{t.name}</span>
            <span className="text-xl font-bold">{t.points}</span>
          </div>
        ))}
      </div>
      {view.me.isHost ? (
        <button className="btn btn-primary w-full" onClick={() => act("next").catch(() => {})}>
          {last ? "Show results" : "Next question"} <span className="opacity-60">· {nextIn}</span>
        </button>
      ) : (
        <p className="text-center text-sm text-muted">
          {last ? "Results" : "Next question"} in {nextIn}…
        </p>
      )}
    </div>
  );
}
