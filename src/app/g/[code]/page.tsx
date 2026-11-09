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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-gold" />
        <p className="text-muted">{error || "Loading…"}</p>
      </div>
    );
  }

  const now = () => Date.now() + offset;

  return (
    <>
      {error && (
        <button onClick={() => setError("")} className="shake fixed inset-x-4 top-3 z-40 mx-auto max-w-md rounded-xl bg-bad px-4 py-3 text-center font-semibold shadow-lg">
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
  const steps = ["Writing questions…", "Checking every answer…", "Making sure nothing repeats…", "Setting the scores…"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 6000);
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/10 border-t-gold" />
      <div className="eyebrow !text-gold">Round {view.round}</div>
      <h1 className="text-2xl font-bold">Get ready</h1>
      <p className="rise text-muted" key={i}>
        {steps[i]}
      </p>
      <p className="text-xs text-muted/70">This usually takes under a minute.</p>
    </div>
  );
}
