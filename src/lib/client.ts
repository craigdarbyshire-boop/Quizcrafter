"use client";

export interface Seat {
  playerId: string;
  token: string;
}

const key = (code: string) => `quizcrafter:${code.toUpperCase()}`;

/** Remembers which player this phone is in a game, so a refresh rejoins automatically. */
export function saveSeat(code: string, seat: Seat) {
  try {
    localStorage.setItem(key(code), JSON.stringify(seat));
  } catch {
    // Private browsing: the phone just won't rejoin after a refresh.
  }
}

export function loadSeat(code: string): Seat | null {
  try {
    const raw = localStorage.getItem(key(code));
    return raw ? (JSON.parse(raw) as Seat) : null;
  } catch {
    return null;
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers: {
      "content-type": "application/json",
      ...(opts.token ? { "x-player-token": opts.token } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as T;
}
