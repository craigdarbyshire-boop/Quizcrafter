"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-12">
      <div className="rise">
        <Logo />
      </div>

      <div className="panel w-full space-y-5 p-6">
        <Link href="/new" className="btn btn-primary w-full text-lg">
          Host a game
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/15" />
          <span className="eyebrow">or join with a code</span>
          <div className="h-px flex-1 bg-white/15" />
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
            placeholder="CODE"
            autoCapitalize="characters"
            className="field w-0 flex-1 text-center text-2xl font-bold tracking-[0.4em]"
          />
          <button type="submit" className="btn btn-blue" disabled={code.length !== 4}>
            Join
          </button>
        </form>
      </div>
    </div>
  );
}
