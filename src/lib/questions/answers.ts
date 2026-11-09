import { normalizeText } from "./similarity";
import type { Question } from "./types";

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

function stripArticles(s: string): string {
  return s.replace(/^(the|a|an) /, "");
}

/**
 * Checks a player's answer. Typed answers forgive case, punctuation, a leading
 * "the", and small spelling slips (1 letter per 5), since the players are kids.
 */
export function isCorrectAnswer(question: Pick<Question, "type" | "answer" | "accepted_answers">, given: string): boolean {
  const guess = stripArticles(normalizeText(given));
  if (!guess) return false;

  if (question.type !== "typed") {
    return guess === stripArticles(normalizeText(question.answer));
  }

  const accepted = [question.answer, ...question.accepted_answers].map((a) => stripArticles(normalizeText(a)));
  return accepted.some((target) => {
    if (!target) return false;
    if (guess === target) return true;
    // Numbers must match exactly: "1066" is not "1065".
    if (/\d/.test(target)) return false;
    const allowed = Math.floor(target.length / 5);
    return allowed > 0 && levenshtein(guess, target) <= allowed;
  });
}
