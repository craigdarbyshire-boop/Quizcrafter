import { randomUUID } from "crypto";
import type { QuestionWriter } from "./ai";
import { categoryKey, type HistoryStore } from "./history";
import { fingerprint, isDuplicate, type Fingerprint } from "./similarity";
import { POINTS_RANGE, type GenerateRequest, type GeneratedQuestion, type Question } from "./types";

const MAX_ATTEMPTS = 3;

export class QuestionEngineError extends Error {}

/** Fixes small slips in the AI's output, or returns null if the question can't be used. */
export function tidyQuestion(q: GeneratedQuestion, req: GenerateRequest, category: string): GeneratedQuestion | null {
  if (!req.types.includes(q.type)) return null;
  const question = q.question.trim();
  const answer = q.answer.trim();
  if (!question || !answer) return null;

  let options = q.options.map((o) => o.trim()).filter(Boolean);
  if (q.type === "multiple_choice") {
    if (options.length !== 4 || new Set(options.map((o) => o.toLowerCase())).size !== 4) return null;
    const match = options.find((o) => o.toLowerCase() === answer.toLowerCase());
    if (!match) return null;
    return finish({ ...q, question, options, answer: match });
  }
  if (q.type === "true_false") {
    const tf = answer.toLowerCase();
    if (tf !== "true" && tf !== "false") return null;
    options = ["True", "False"];
    return finish({ ...q, question, options, answer: tf === "true" ? "True" : "False" });
  }
  return finish({ ...q, question, options: [], answer });

  function finish(out: GeneratedQuestion): GeneratedQuestion {
    const range = POINTS_RANGE[req.difficulty];
    return {
      ...out,
      category,
      accepted_answers: out.type === "typed" ? out.accepted_answers.map((a) => a.trim()).filter(Boolean) : [],
      difficulty_rating: Math.min(5, Math.max(1, Math.round(out.difficulty_rating))),
      points: Math.min(range.max, Math.max(range.min, Math.round(out.points))),
      fun_fact: out.fun_fact.trim(),
    };
  }
}

/**
 * Writes a game's questions: asks the AI for each category, throws away anything
 * that repeats a past question (or another question in this game) or fails the
 * accuracy check, asks again for replacements, then records the final set in history.
 */
export async function generateQuestions(
  req: GenerateRequest,
  deps: { writer: QuestionWriter; history: HistoryStore },
): Promise<Question[]> {
  const categories = mergeCategories(req);
  const past = await deps.history.list(categories.map((c) => c.category));
  const seen: Fingerprint[] = past.map((p) => fingerprint(p.question, p.answer));

  const perCategory = await Promise.all(
    categories.map(async ({ category, count }) => {
      const pastHere = past.filter((p) => categoryKey(p.category) === categoryKey(category)).map((p) => p.question);
      const kept: GeneratedQuestion[] = [];
      for (let attempt = 0; attempt < MAX_ATTEMPTS && kept.length < count; attempt++) {
        const need = count - kept.length;
        // Ask for a few extra, since some will be dropped.
        const written = await deps.writer.write({
          category,
          count: need + Math.ceil(need / 4),
          difficulty: req.difficulty,
          types: req.types,
          avoid: [...kept.map((k) => k.question), ...pastHere],
        });
        const candidates = written
          .map((q) => tidyQuestion(q, req, category))
          .filter((q): q is GeneratedQuestion => q !== null);
        const bad = new Set(await deps.writer.findProblems(candidates));
        for (const [i, q] of candidates.entries()) {
          if (kept.length >= count) break;
          if (bad.has(i)) continue;
          const fp = fingerprint(q.question, q.answer);
          // `seen` is shared across categories, so two teams never get the same question either.
          if (seen.some((s) => isDuplicate(fp, s))) continue;
          seen.push(fp);
          kept.push(q);
        }
      }
      if (kept.length < count) {
        throw new QuestionEngineError(
          `Couldn't find ${count} new questions for "${category}" (got ${kept.length}). Try another category or reset the question history.`,
        );
      }
      return kept;
    }),
  );

  const questions: Question[] = perCategory.flat().map((q) => ({ ...q, id: randomUUID() }));
  await deps.history.add(questions);
  return questions;
}

/** Two teams may pick the same category; ask for those questions in one go so they can't overlap. */
function mergeCategories(req: GenerateRequest) {
  const merged = new Map<string, { category: string; count: number }>();
  for (const { category, count } of req.categories) {
    const key = categoryKey(category);
    const existing = merged.get(key);
    if (existing) existing.count += count;
    else merged.set(key, { category: category.trim(), count });
  }
  return [...merged.values()];
}
