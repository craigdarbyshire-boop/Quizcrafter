import { z } from "zod";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const AUDIENCES = ["teens", "mixed", "adults"] as const;
export type Audience = (typeof AUDIENCES)[number];

/** Games saved before the audience options were renamed still load. */
export function normalizeAudience(a: unknown): Audience {
  if (a === "kids" || a === "teens") return "teens";
  if (a === "adults") return "adults";
  return "mixed";
}

export const QUESTION_TYPES = ["multiple_choice", "true_false", "typed"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Points the AI may award for one question, by the difficulty chosen at setup. */
export const POINTS_RANGE: Record<Difficulty, { min: number; max: number }> = {
  easy: { min: 5, max: 15 },
  medium: { min: 10, max: 25 },
  hard: { min: 20, max: 40 },
};

/** What the AI returns for each question (before we add ids and clamp points). */
export const GeneratedQuestionSchema = z.object({
  category: z.string(),
  type: z.enum(QUESTION_TYPES),
  question: z.string(),
  /** Four options for multiple_choice, ["True","False"] for true_false, empty for typed. */
  options: z.array(z.string()),
  /** The correct answer, written exactly as it appears in options (for typed: the main answer). */
  answer: z.string(),
  /** Other spellings or forms accepted for typed answers. Empty for other types. */
  accepted_answers: z.array(z.string()),
  /** How hard this particular question is, 1 (easiest) to 5 (hardest). */
  difficulty_rating: z.number().int(),
  points: z.number().int(),
  fun_fact: z.string(),
});

export const GeneratedBatchSchema = z.object({
  questions: z.array(GeneratedQuestionSchema),
});

export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export interface Question extends GeneratedQuestion {
  id: string;
}

/** One slice of a game: e.g. each team picks its own category and gets N questions from it. */
export interface CategoryRequest {
  category: string;
  count: number;
}

export interface GenerateRequest {
  categories: CategoryRequest[];
  difficulty: Difficulty;
  /** Who's playing, so questions suit their age. Defaults to mixed. */
  audience?: Audience;
  /** Which question types are allowed in this game. */
  types: QuestionType[];
}

export const GenerateRequestSchema = z.object({
  categories: z
    .array(
      z.object({
        category: z.string().trim().min(1).max(60),
        count: z.number().int().min(1).max(30),
      }),
    )
    .min(1)
    .max(10),
  difficulty: z.enum(DIFFICULTIES),
  audience: z.enum(AUDIENCES).optional(),
  types: z.array(z.enum(QUESTION_TYPES)).min(1),
});
