import { createGame } from "@/lib/game/game";
import { gameDeps, handle } from "@/lib/game/server";

export const runtime = "nodejs";

/** POST /api/games — the host creates a game. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return handle(() => createGame(gameDeps(), body));
}
