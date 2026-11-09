import { getView } from "@/lib/game/game";
import { gameDeps, handle, tokenFrom } from "@/lib/game/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/games/CODE — everything this phone should show right now. Phones poll this. */
export async function GET(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  return handle(() => getView(gameDeps(), code, tokenFrom(request)));
}
