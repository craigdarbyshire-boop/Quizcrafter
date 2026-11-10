"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { api, saveSeat, type Seat } from "@/lib/client";
import { DEFAULT_SETTINGS, MODE_LABELS, TEAM_COLORS, TIME_LIMITS, type Settings } from "@/lib/game/types";
import type { Audience, Difficulty, QuestionType } from "@/lib/questions/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="eyebrow">{title}</div>
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T | readonly T[];
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
          className={`rounded-xl border px-4 py-2.5 font-semibold transition ${
            selected(o) ? "border-gold bg-gold/15 text-gold" : "border-white/15 bg-black/30 text-ink"
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
    <div className="flex items-center gap-3">
      <button type="button" aria-label="Less" className="btn btn-ghost h-11 w-11 !p-0 text-xl" disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <div className="w-10 text-center text-3xl font-bold">{value}</div>
      <button type="button" aria-label="More" className="btn btn-ghost h-11 w-11 !p-0 text-xl" disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple choice",
  true_false: "True or false",
  typed: "Type the answer",
};
const AUDIENCE_LABELS: Record<Audience, string> = { teens: "Teens (14+)", mixed: "Teens & adults", adults: "Adults" };
const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

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
      <h1 className="text-center text-2xl font-bold">Set up your game</h1>

      <div className="panel space-y-7 p-5">
        <Section title="Your name">
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="Quizmaster" className="field" />
        </Section>

        <div className="grid grid-cols-2 gap-4">
          <Section title="Teams">
            <Stepper value={s.teams} min={2} max={10} onChange={(v) => set("teams", v)} />
          </Section>
          <Section title="Questions">
            <Stepper value={s.questions} min={5} max={30} onChange={(v) => set("questions", v)} />
          </Section>
        </div>
        <div className="-mt-3 flex gap-1.5" aria-hidden>
          {TEAM_COLORS.slice(0, s.teams).map((c) => (
            <span key={c} className="h-1.5 flex-1 rounded-full" style={{ background: c }} />
          ))}
        </div>

        <Section title="Who's playing?">
          <Segmented options={["teens", "mixed", "adults"] as const} value={s.audience} onChange={(v) => set("audience", v)} label={(v) => AUDIENCE_LABELS[v]} />
        </Section>

        <Section title="Difficulty">
          <Segmented options={["easy", "medium", "hard"] as const} value={s.difficulty} onChange={(v) => set("difficulty", v)} label={(v) => DIFFICULTY_LABELS[v]} />
        </Section>

        <Section title="Time to answer">
          <Segmented options={TIME_LIMITS} value={s.timeLimit as (typeof TIME_LIMITS)[number]} onChange={(v) => set("timeLimit", v)} label={(v) => `${v}s`} />
        </Section>

        <Section title="Answer mode">
          <div className="grid gap-2">
            {(
              [
                ["silent", MODE_LABELS.silent, "Each team locks in one answer."],
                ["fastest", MODE_LABELS.fastest, "First correct answer takes the points."],
                ["mixed", MODE_LABELS.mixed, "A shuffle of both. Each question shows which it is."],
              ] as const
            ).map(([mode, title, blurb]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={s.mode === mode}
                onClick={() => set("mode", mode)}
                className={`rounded-xl border px-4 py-3 text-left transition ${s.mode === mode ? "border-gold bg-gold/10" : "border-white/15 bg-black/30"}`}
              >
                <div className={`font-bold ${s.mode === mode ? "text-gold" : ""}`}>{title}</div>
                <div className="text-sm text-muted">{blurb}</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Question types">
          <Segmented
            options={["multiple_choice", "true_false", "typed"] as const}
            value={s.types}
            label={(v) => TYPE_LABELS[v]}
            onChange={(v) => {
              const next = s.types.includes(v) ? s.types.filter((t) => t !== v) : [...s.types, v];
              if (next.length) set("types", next);
            }}
          />
        </Section>

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/15 bg-black/30 px-4 py-3">
          <div>
            <div className="font-bold">Leaderboard</div>
            <div className="text-sm text-muted">Track round wins over several rounds</div>
          </div>
          <input type="checkbox" className="h-6 w-6 accent-[#f5c542]" checked={s.leaderboard} onChange={(e) => set("leaderboard", e.target.checked)} />
        </label>
      </div>

      <p className="text-center text-sm text-muted">Teams choose their own names and categories in the lobby.</p>
      {error && <p className="shake rounded-xl border border-bad/50 bg-bad/15 px-4 py-2 text-center">{error}</p>}
      <button className="btn btn-primary text-lg" disabled={busy || !name.trim()}>
        {busy ? "Creating…" : "Create game"}
      </button>
    </form>
  );
}
