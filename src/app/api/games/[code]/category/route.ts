import { setCategory } from "@/lib/game/game";
import { gameDeps, handle, tokenFrom } from "@/lib/game/server";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  return handle(() => setCategory(gameDeps(), code, tokenFrom(request), body));
}
