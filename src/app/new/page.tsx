"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { api, saveSeat, type Seat } from "@/lib/client";
import { DEFAULT_SETTINGS, TEAMS, TIME_LIMITS, type Settings } from "@/lib/game/types";
import type { QuestionType } from "@/lib/questions/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</div>
      {children}
    </div>
  );
}

function Chips<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T | T[];
  onChange: (v: T) => void;
  label?: (v: T) => string;
}) {
  const selected = (o: T) => (Array.isArray(value) ? value.includes(o) : value === o);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          aria-pressed={selected(o)}
          onClick={() => onChange(o)}
          className={`rounded-full border-2 px-4 py-2 text-lg font-semibold transition ${
            selected(o) ? "border-yellow bg-yellow text-[#3a1d00]" : "border-white/25 bg-white/10 text-white"
          }`}
        >
          {label ? label(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <button type="button" aria-label="Less" className="btn btn-ghost h-12 w-12 !p-0 text-2xl" disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <div className="w-12 text-center text-3xl font-bold">{value}</div>
      <button type="button" aria-label="More" className="btn btn-ghost h-12 w-12 !p-0 text-2xl" disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "🔤 Multiple choice",
  true_false: "✅ True / false",
  typed: "⌨️ Type the answer",
};

export default function NewGame() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((prev) => ({ ...prev, [k]: v }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const seat = await api<Seat & { code: string }>("/api/games", { body: { hostName: name, settings: s } });
      saveSeat(seat.code, seat);
      router.push(`/g/${seat.code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create} className="flex flex-col gap-6 pb-10">
      <Logo size="sm" />
      <h1 className="text-center text-3xl font-bold">Set up your game 🎮</h1>

      <div className="card space-y-6 p-5">
        <Section title="Your name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="Quizmaster"
            className="w-full rounded-2xl border-2 border-white/25 bg-white/10 px-4 py-3 text-xl placeholder:text-white/30 focus:border-yellow focus:outline-none"
          />
        </Section>

        <div className="grid grid-cols-2 gap-4">
          <Section title="Teams">
            <Stepper value={s.teams} min={2} max={10} onChange={(v) => set("teams", v)} />
          </Section>
          <Section title="Questions">
            <Stepper value={s.questions} min={5} max={30} onChange={(v) => set("questions", v)} />
          </Section>
        </div>
        <div className="flex flex-wrap gap-1 text-2xl" aria-label="Team mascots">
          {TEAMS.slice(0, s.teams).map((t) => (
            <span key={t.name} className="pop" title={t.name}>
              {t.emoji}
            </span>
          ))}
        </div>

        <Section title="Who's playing?">
          <Chips
            options={["kids", "family", "adults"] as const}
            value={s.audience}
            onChange={(v) => set("audience", v)}
            label={(v) => ({ kids: "🧒 Kids", family: "👨‍👩‍👧 Family", adults: "🧑 Adults" })[v]}
          />
        </Section>

        <Section title="Time to answer">
          <Chips options={TIME_LIMITS} value={s.timeLimit as (typeof TIME_LIMITS)[number]} onChange={(v) => set("timeLimit", v)} label={(v) => `${v}s`} />
        </Section>

        <Section title="Difficulty">
          <Chips
            options={["easy", "medium", "hard"] as const}
            value={s.difficulty}
            onChange={(v) => set("difficulty", v)}
            label={(v) => ({ easy: "😊 Easy", medium: "🤔 Medium", hard: "🔥 Hard" })[v]}
          />
        </Section>

        <Section title="How to answer">
          <div className="grid gap-2">
            {(
              [
                ["silent", "🤫 Silent answers", "Each team quietly locks in one answer."],
                ["fastest", "⚡ Fastest first", "First right answer wins the points!"],
              ] as const
            ).map(([mode, title, blurb]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={s.mode === mode}
                onClick={() => set("mode", mode)}
                className={`rounded-2xl border-2 px-4 py-3 text-left transition ${s.mode === mode ? "border-yellow bg-yellow/15" : "border-white/20 bg-white/5"}`}
              >
                <div className="text-lg font-bold">{title}</div>
                <div className="text-sm text-muted">{blurb}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Question types">
          <Chips
            options={["multiple_choice", "true_false", "typed"] as const}
            value={s.types}
            label={(v) => TYPE_LABELS[v]}
            onChange={(v) => {
              const next = s.types.includes(v) ? s.types.filter((t) => t !== v) : [...s.types, v];
              if (next.length) set("types", next);
            }}
          />
        </Section>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 border-white/20 bg-white/5 px-4 py-3">
          <div>
            <div className="text-lg font-bold">🏆 Leaderboard</div>
            <div className="text-sm text-muted">Keep score across several rounds</div>
          </div>
          <input type="checkbox" className="h-7 w-7 accent-yellow" checked={s.leaderboard} onChange={(e) => set("leaderboard", e.target.checked)} />
        </label>
      </div>

      <p className="text-center text-sm text-muted">Each team picks its own category in the waiting room.</p>
      {error && <p className="wiggle rounded-2xl bg-coral/25 px-4 py-2 text-center">{error}</p>}
      <button className="btn btn-primary text-xl" disabled={busy || !name.trim()}>
        {busy ? "Creating…" : "Create game 🎉"}
      </button>
    </form>
  );
}
