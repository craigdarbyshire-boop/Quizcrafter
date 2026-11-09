"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Confetti } from "@/components/Confetti";
import { Lobby } from "@/components/Lobby";
import { QuestionScreen } from "@/components/QuestionScreen";
import { RoundOver } from "@/components/RoundOver";
import { api, loadSeat, type Seat } from "@/lib/client";
import type { GameView } from "@/lib/game/game";

const POLL_MS = 1000;

export default function GamePage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = rawCode.toUpperCase();
  const router = useRouter();
  const [seat, setSeat] = useState<Seat | null>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    const s = loadSeat(code);
    if (!s) router.replace(`/join?code=${code}`);
    else setSeat(s);
  }, [code, router]);

  const refresh = useCallback(async () => {
    if (!seat || inFlight.current) return;
    inFlight.current = true;
    try {
      const sentAt = Date.now();
      const v = await api<GameView>(`/api/games/${code}`, { token: seat.token });
      // Estimate the gap between this phone's clock and the server's, so every timer agrees.
      setOffset(v.serverNow - (sentAt + Date.now()) / 2);
      setView(v);
      setError("");
    } catch (err) {
      const msg = (err as Error).message;
      if (/not in this game/.test(msg)) router.replace(`/join?code=${code}`);
      setError(msg);
    } finally {
      inFlight.current = false;
    }
  }, [seat, code, router]);

  useEffect(() => {
    if (!seat) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [seat, refresh]);

  const act = useCallback(
    async (path: string, body?: unknown) => {
      if (!seat) return;
      try {
        const res = await api(`/api/games/${code}/${path}`, { token: seat.token, body: body ?? {} });
        await refresh();
        return res;
      } catch (err) {
        setError((err as Error).message);
        await refresh();
        throw err;
      }
    },
    [seat, code, refresh],
  );

  if (!view) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="bounce text-6xl">🧠</div>
        <p className="text-muted">{error || "Loading…"}</p>
      </div>
    );
  }

  const now = () => Date.now() + offset;

  return (
    <>
      {error && (
        <button onClick={() => setError("")} className="wiggle fixed inset-x-4 top-3 z-40 mx-auto max-w-md rounded-2xl bg-coral px-4 py-3 text-center font-semibold shadow-lg">
          {error}
        </button>
      )}
      {view.phase === "lobby" && <Lobby view={view} act={act} />}
      {view.phase === "generating" && <Generating view={view} />}
      {(view.phase === "question" || view.phase === "reveal") && <QuestionScreen key={`${view.round}-${view.question?.index}`} view={view} act={act} now={now} />}
      {(view.phase === "round_over" || view.phase === "ended") && <RoundOver view={view} act={act} />}
      {view.phase === "reveal" && view.mine?.correct && <Confetti key={`c-${view.round}-${view.question?.index}`} />}
    </>
  );
}

function Generating({ view }: { view: GameView }) {
  const tips = ["Sharpening pencils…", "Asking the owls…", "Counting the stars…", "Checking every answer twice…", "Hiding the easy ones…"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % tips.length), 2200);
    return () => clearInterval(id);
  }, [tips.length]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <div className="bounce text-7xl">🤖</div>
      <h1 className="text-3xl font-bold">Writing round {view.round}!</h1>
      <p className="pop text-xl text-muted" key={i}>
        {tips[i]}
      </p>
      <p className="text-sm text-muted">This takes about half a minute.</p>
    </div>
  );
}
