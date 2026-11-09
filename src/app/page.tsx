"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10">
      <div className="pop">
        <div className="bounce mb-4 text-center text-6xl">🧠</div>
        <Logo />
      </div>

      <div className="card w-full space-y-4 p-6">
        <Link href="/new" className="btn btn-primary w-full text-xl">
          ✨ Start a new game
        </Link>
        <div className="flex items-center gap-3 text-sm text-muted">
          <div className="h-px flex-1 bg-white/20" />
          or join with a code
          <div className="h-px flex-1 bg-white/20" />
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim().length === 4) router.push(`/join?code=${code.trim().toUpperCase()}`);
          }}
        >
          <input
            aria-label="Game code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase())}
            placeholder="ABCD"
            autoCapitalize="characters"
            className="w-0 flex-1 rounded-full border-2 border-white/25 bg-white/10 px-5 text-center text-2xl font-bold tracking-[0.4em] placeholder:text-white/30 focus:border-yellow focus:outline-none"
          />
          <button type="submit" className="btn btn-pink" disabled={code.length !== 4}>
            Join
          </button>
        </form>
      </div>
    </div>
  );
}
