"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/Logo";
import { api, saveSeat, type Seat } from "@/lib/client";

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const seat = await api<Seat & { code: string }>(`/api/games/${code}/join`, { body: { name } });
      saveSeat(seat.code, seat);
      router.push(`/g/${seat.code}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <Logo size="sm" />
      <form onSubmit={join} className="panel rise w-full space-y-5 p-6">
        <h1 className="text-center text-2xl font-bold">Join a game</h1>
        <label className="block space-y-1.5">
          <span className="eyebrow">Game code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase())}
            placeholder="CODE"
            autoCapitalize="characters"
            className="field text-center text-3xl font-bold tracking-[0.4em]"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="eyebrow">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="Your name"
            autoFocus={code.length === 4}
            className="field"
          />
        </label>
        {error && <p className="shake rounded-xl border border-bad/50 bg-bad/15 px-4 py-2 text-center">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy || code.length !== 4 || !name.trim()}>
          {busy ? "Joining…" : "Join game"}
        </button>
      </form>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  );
}
