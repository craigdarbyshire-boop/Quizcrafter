import { NextResponse } from "next/server";
import { ClaudeQuestionWriter } from "@/lib/questions/ai";
import { generateQuestions, QuestionEngineError } from "@/lib/questions/engine";
import { historyStoreFromEnv } from "@/lib/questions/history";
import { GenerateRequestSchema } from "@/lib/questions/types";

export const runtime = "nodejs";
// Writing and checking a full game's questions can take a minute or two.
export const maxDuration = 300;

/** POST /api/questions — write a game's questions. Body: { categories: [{category, count}], difficulty, types }. */
export async function POST(request: Request) {
  const parsed = GenerateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }
  try {
    const questions = await generateQuestions(parsed.data, {
      writer: new ClaudeQuestionWriter(),
      history: historyStoreFromEnv(),
    });
    return NextResponse.json({ questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong writing questions.";
    const status = err instanceof QuestionEngineError ? 422 : 500;
    console.error("question generation failed", err);
    return NextResponse.json({ error: message }, { status });
  }
}
