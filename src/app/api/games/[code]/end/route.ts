import { endSession } from "@/lib/game/game";
import { gameDeps, handle, tokenFrom } from "@/lib/game/server";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(() => endSession(gameDeps(), code, tokenFrom(request)));
}
