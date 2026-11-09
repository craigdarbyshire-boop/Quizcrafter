import { NextResponse } from "next/server";
import { historyStoreFromEnv } from "@/lib/questions/history";

export const runtime = "nodejs";

/** DELETE /api/questions/history — the "reset question history" button. */
export async function DELETE() {
  try {
    await historyStoreFromEnv().reset();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("history reset failed", err);
    return NextResponse.json({ error: "Couldn't reset the question history." }, { status: 500 });
  }
}
