import type { QuestionWriter, WriteRequest } from "./ai";
import { POINTS_RANGE, type GeneratedQuestion } from "./types";

/**
 * Stand-in for the AI, for testing the game without an API key.
 * Makes simple numbered arithmetic questions so they never repeat.
 */
export class DemoQuestionWriter implements QuestionWriter {
  private n = 0;

  async write(req: WriteRequest): Promise<GeneratedQuestion[]> {
    const range = POINTS_RANGE[req.difficulty];
    return Array.from({ length: req.count }, () => {
      const n = ++this.n;
      const a = 2 + (n % 9);
      const b = 3 + ((n * 7) % 11);
      const type = req.types[n % req.types.length];
      const base = { category: req.category, accepted_answers: [], difficulty_rating: 2, points: range.min + (n % 3) * 5, fun_fact: `Demo question number ${n}.` };
      if (type === "true_false") {
        const shown = n % 2 ? a + b : a + b + 1;
        return { ...base, type, question: `(${req.category} #${n}) True or false: ${a} + ${b} = ${shown}`, options: ["True", "False"], answer: shown === a + b ? "True" : "False" };
      }
      if (type === "typed") {
        return { ...base, type, question: `(${req.category} #${n}) What is ${a} × ${b}?`, options: [], answer: String(a * b) };
      }
      const right = a + b;
      return { ...base, type, question: `(${req.category} #${n}) What is ${a} + ${b}?`, options: [right, right + 1, right - 1, right + 2].map(String), answer: String(right) };
    });
  }

  async findProblems(): Promise<number[]> {
    return [];
  }
}
