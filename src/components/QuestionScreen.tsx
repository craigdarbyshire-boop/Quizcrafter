"use client";

import { useEffect, useState } from "react";
import type { GameView } from "@/lib/game/game";
import { TEAMS } from "@/lib/game/types";

type Act = (path: string, body?: unknown) => Promise<unknown>;

const TILE_COLORS = [
  "linear-gradient(180deg,#ff6fb5,#ff3d8f)",
  "linear-gradient(180deg,#5ad3ff,#2a9df4)",
  "linear-gradient(180deg,#5ef0bf,#18c48d)",
  "linear-gradient(180deg,#b38bff,#7c4dff)",
];
const TF_COLORS = ["linear-gradient(180deg,#5ef0bf,#18c48d)", "linear-gradient(180deg,#ff8a6b,#ff5a3c)"];

function useNow(now: () => number, ms = 100) {
  const [t, setT] = useState(now());
  useEffect(() => {
    const id = setInterval(() => setT(now()), ms);
    return () => clearInterval(id);
  }, [now, ms]);
  return t;
}

function TimerRing({ endsAt, total, now }: { endsAt: number; total: number; now: number }) {
  const left = Math.max(0, endsAt - now);
  const frac = Math.min(1, left / (total * 1000));
  const secs = Math.ceil(left / 1000);
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = frac > 0.5 ? "#3ce8b0" : frac > 0.25 ? "#ffd23f" : "#ff4f6b";
  return (
    <div className={`relative h-16 w-16 ${secs <= 3 && secs > 0 ? "wiggle" : ""}`} key={secs <= 3 ? secs : "t"}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="rgba(255,255,255,0.15)" strokeWidth="7" fill="#170b45" />
        <circle cx="32" cy="32" r={r} stroke={color} strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-2xl font-bold" style={{ color }}>
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
  const myTeam = TEAMS[view.me.team];
  const pickedBy = TEAMS[q.pickedBy];
  const locked = !!view.mine || sending;
  const fastest = view.settings.mode === "fastest";

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
      {/* Top bar */}
      <div className="flex items-center gap-3">
        {revealing ? (
          <div className="pop grid h-16 w-16 place-items-center rounded-full bg-white/15 text-3xl">{view.mine?.correct ? "🎉" : "👀"}</div>
        ) : (
          <TimerRing endsAt={q.endsAt} total={view.settings.timeLimit} now={t} />
        )}
        <div className="flex-1">
          <div className="text-sm text-muted">
            Question {q.index + 1} of {q.total}
            {view.round > 1 ? ` · Round ${view.round}` : ""}
          </div>
          <div className="truncate font-semibold">
            {pickedBy.emoji} {q.category}
          </div>
        </div>
        <div className="rounded-2xl bg-yellow px-3 py-2 text-center font-bold leading-tight text-[#3a1d00]">
          {q.points}
          <div className="text-[10px] uppercase">points</div>
        </div>
      </div>

      {/* Question */}
      <div className="question-card pop px-5 py-8 text-center">
        <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{q.text}</h1>
      </div>

      {/* Answers */}
      {q.type === "typed" ? (
        <TypedAnswer
          value={view.mine?.answer ?? typed}
          onChange={setTyped}
          onSubmit={() => answer(typed)}
          disabled={locked || revealing}
          revealing={revealing}
          correctAnswer={q.answer}
        />
      ) : (
        <div className={`grid gap-3 ${q.type === "true_false" ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
          {q.options.map((o, i) => {
            const right = isAnswer(o);
            const mineHere = chosen === o;
            const dim = (revealing && !right) || (!revealing && locked && !mineHere);
            return (
              <button
                key={o}
                disabled={locked || revealing}
                onClick={() => answer(o)}
                className={`answer-tile ${q.type === "true_false" ? "!min-h-28 !pl-4 text-center !text-2xl" : ""} ${right ? "pop" : ""}`}
                style={{
                  background: q.type === "true_false" ? TF_COLORS[i] : TILE_COLORS[i % 4],
                  opacity: dim ? 0.35 : 1,
                  outline: mineHere ? "4px solid white" : right ? "4px solid #ffd23f" : undefined,
                  outlineOffset: 3,
                  boxShadow: right ? "0 0 30px #ffd23f" : undefined,
                }}
              >
                {q.type !== "true_false" && <span className="badge">{"ABCD"[i]}</span>}
                {q.type === "true_false" ? (o === "True" ? "👍 True" : "👎 False") : o}
                {right && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl">✅</span>}
              </button>
            );
          })}
        </div>
      )}

      <StatusLine view={view} myTeamName={`${myTeam.emoji} ${myTeam.name}`} fastest={fastest} />

      {revealing && <Reveal view={view} act={act} now={t} />}
    </div>
  );
}

function TypedAnswer({
  value,
  onChange,
  onSubmit,
  disabled,
  revealing,
  correctAnswer,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  revealing: boolean;
  correctAnswer: string | null;
}) {
  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 100))}
          disabled={disabled}
          placeholder="Type your answer…"
          autoComplete="off"
          className="w-0 flex-1 rounded-2xl border-2 border-white/30 bg-[#170b45] px-4 py-4 text-xl font-semibold placeholder:text-white/30 focus:border-yellow focus:outline-none disabled:opacity-70"
        />
        <button className="btn btn-primary !rounded-2xl" disabled={disabled || !value.trim()}>
          Go!
        </button>
      </form>
      {revealing && correctAnswer && (
        <div className="pop rounded-2xl border-2 border-yellow bg-yellow/15 px-4 py-3 text-center text-xl font-bold">✅ {correctAnswer}</div>
      )}
    </div>
  );
}

function StatusLine({ view, myTeamName, fastest }: { view: GameView; myTeamName: string; fastest: boolean }) {
  const q = view.question!;
  const revealing = view.phase === "reveal";
  const mine = view.mine;
  let text: React.ReactNode;
  if (revealing) {
    if (!mine) text = fastest ? "You didn't answer this time." : `${myTeamName} didn't answer in time.`;
    else if (mine.correct) text = fastest && q.winner?.playerId !== view.me.id ? "Right, but someone was faster! ⚡" : `Correct! +${q.points} for ${myTeamName} 🎉`;
    else text = "Not this time! 💪";
  } else if (mine) {
    if (fastest) text = mine.correct ? "Correct! ⚡" : "Oops! You're out for this one. 🙈";
    else text = `🔒 ${myTeamName} locked in${mine.by && mine.by !== view.me.name ? ` (by ${mine.by})` : ""}. Waiting for the others…`;
  } else {
    text = fastest ? "Be the first to get it right! ⚡" : `One answer for ${myTeamName}. Talk it over quietly! 🤫`;
  }
  const waitingTeams = view.teams.filter((t) => t.players.length > 0);
  return (
    <div className="space-y-2 text-center">
      <p className={`text-lg font-semibold ${revealing ? "pop" : ""}`}>{text}</p>
      {!revealing && !fastest && (
        <div className="flex flex-wrap justify-center gap-2">
          {waitingTeams.map((t) => (
            <span
              key={t.team}
              className="rounded-full px-3 py-1 text-sm font-semibold transition"
              style={{ background: q.answeredTeams.includes(t.team) ? t.color : "rgba(255,255,255,0.1)" }}
            >
              {t.emoji} {q.answeredTeams.includes(t.team) ? "✓" : "…"}
            </span>
          ))}
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
  return (
    <div className="space-y-4">
      {q.winner && (
        <div className="pop card p-3 text-center text-lg">
          ⚡ <b>{q.winner.name}</b> was fastest for {TEAMS[q.winner.team].emoji} {TEAMS[q.winner.team].name}!
        </div>
      )}
      {q.funFact && (
        <div className="pop card p-4">
          <div className="text-sm font-semibold uppercase tracking-wider text-yellow">💡 Fun fact</div>
          <p className="mt-1">{q.funFact}</p>
        </div>
      )}
      <div className="card space-y-2 p-4">
        {sorted.map((t, i) => (
          <div key={t.team} className="flex items-center gap-3">
            <span className="w-6 text-center font-bold text-muted">{i + 1}</span>
            <span className="text-2xl">{t.emoji}</span>
            <span className="flex-1 font-semibold">{t.name}</span>
            <span className="text-xl font-bold" style={{ color: t.color }}>
              {t.points}
            </span>
          </div>
        ))}
      </div>
      {view.me.isHost ? (
        <button className="btn btn-primary w-full text-xl" onClick={() => act("next").catch(() => {})}>
          {last ? "See the results 🏆" : "Next question ➡️"} <span className="text-base opacity-70">({nextIn})</span>
        </button>
      ) : (
        <p className="text-center text-muted">{last ? "Results" : "Next question"} in {nextIn}…</p>
      )}
    </div>
  );
}
