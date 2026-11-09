import "server-only";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ClaudeQuestionWriter, type QuestionWriter } from "../questions/ai";
import { DemoQuestionWriter } from "../questions/demo";
import { generateQuestions } from "../questions/engine";
import { MemoryHistoryStore, SupabaseHistoryStore, type HistoryStore } from "../questions/history";
import { GameError, type GameDeps } from "./game";
import { MemoryGameStore, type GameStore } from "./store";
import { SupabaseGameStore } from "./supabase-store";

interface Backends {
  store: GameStore;
  history: HistoryStore;
  writer: QuestionWriter;
}

// Kept on globalThis so local dev keeps its in-memory games across hot reloads.
const g = globalThis as unknown as { __quizcrafter?: Backends };

function backends(): Backends {
  if (g.__quizcrafter) return g.__quizcrafter;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  if (!db && process.env.NODE_ENV === "production" && !process.env.QUIZCRAFTER_MEMORY_STORE) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  // QUIZCRAFTER_DEMO_QUESTIONS=1 uses built-in questions instead of the AI (for testing without an API key).
  const writer = process.env.QUIZCRAFTER_DEMO_QUESTIONS ? new DemoQuestionWriter() : new ClaudeQuestionWriter();
  g.__quizcrafter = {
    store: db ? new SupabaseGameStore(db) : new MemoryGameStore(),
    history: db ? new SupabaseHistoryStore(db) : new MemoryHistoryStore(),
    writer,
  };
  return g.__quizcrafter;
}

export function gameDeps(): GameDeps {
  const b = backends();
  return {
    store: b.store,
    writeQuestions: (req) => generateQuestions(req, { writer: b.writer, history: b.history }),
  };
}

export function historyStore(): HistoryStore {
  return backends().history;
}

export function tokenFrom(request: Request): string {
  return request.headers.get("x-player-token") ?? "";
}

/** Runs a route handler and turns errors into JSON responses the phone can show. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    return NextResponse.json(result ?? { ok: true });
  } catch (err) {
    if (err instanceof GameError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
