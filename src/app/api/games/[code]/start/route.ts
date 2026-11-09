import { startRound } from "@/lib/game/game";
import { gameDeps, handle, tokenFrom } from "@/lib/game/server";

export const runtime = "nodejs";
// Writing a round of questions can take a minute or two.
export const maxDuration = 300;

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(() => startRound(gameDeps(), code, tokenFrom(request)));
}
