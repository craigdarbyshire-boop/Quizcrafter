import { NextResponse } from "next/server";
import { historyStore } from "@/lib/game/server";

export const runtime = "nodejs";

/** DELETE /api/questions/history — the "reset question history" button. */
export async function DELETE() {
  try {
    await historyStore().reset();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("history reset failed", err);
    return NextResponse.json({ error: "Couldn't reset the question history." }, { status: 500 });
  }
}
