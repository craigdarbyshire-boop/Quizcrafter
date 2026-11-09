/**
 * Duplicate detection for questions. A question counts as a repeat if it asks the
 * same thing as one already asked, even when reworded.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "is", "are", "was", "were",
  "which", "what", "who", "whom", "whose", "where", "when", "how", "why", "does", "do",
  "did", "this", "that", "these", "those", "and", "or", "by", "with", "from", "as",
  "be", "it", "its", "can", "has", "have", "had", "name", "called", "known", "true",
  "false", "following", "one", "most", "only",
]);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function contentWords(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((w) => w && !STOP_WORDS.has(w))
      .map(stem),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared);
}

export interface Fingerprint {
  normalized: string;
  words: Set<string>;
  answer: string;
}

export function fingerprint(question: string, answer: string): Fingerprint {
  return {
    normalized: normalizeText(question),
    words: contentWords(question),
    answer: normalizeText(answer),
  };
}

/**
 * Same wording, or mostly the same key words. Questions with the same answer
 * are held to a looser bar, since a reworded repeat usually keeps its answer.
 */
export function isDuplicate(a: Fingerprint, b: Fingerprint): boolean {
  if (a.normalized === b.normalized) return true;
  const overlap = jaccard(a.words, b.words);
  const sameAnswer = a.answer !== "" && a.answer === b.answer;
  // True/false answers are shared by half of all questions, so they don't count as a match signal.
  const meaningfulAnswer = sameAnswer && a.answer !== "true" && a.answer !== "false";
  if (meaningfulAnswer) return overlap >= 0.5;
  return overlap >= 0.8;
}
