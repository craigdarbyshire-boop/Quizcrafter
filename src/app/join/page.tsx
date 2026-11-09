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
      <form onSubmit={join} className="card pop w-full space-y-5 p-6">
        <h1 className="text-center text-3xl font-bold">Join the fun! 🎉</h1>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Game code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase())}
            placeholder="ABCD"
            autoCapitalize="characters"
            className="w-full rounded-2xl border-2 border-white/25 bg-white/10 px-4 py-3 text-center text-3xl font-bold tracking-[0.4em] placeholder:text-white/30 focus:border-yellow focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-muted">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="e.g. Super Sam"
            autoFocus={code.length === 4}
            className="w-full rounded-2xl border-2 border-white/25 bg-white/10 px-4 py-3 text-xl placeholder:text-white/30 focus:border-yellow focus:outline-none"
          />
        </label>
        {error && <p className="wiggle rounded-2xl bg-coral/25 px-4 py-2 text-center">{error}</p>}
        <button className="btn btn-primary w-full text-xl" disabled={busy || code.length !== 4 || !name.trim()}>
          {busy ? "Joining…" : "Let's go! 🚀"}
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
