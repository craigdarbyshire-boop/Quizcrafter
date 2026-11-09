import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  GeneratedBatchSchema,
  POINTS_RANGE,
  type Audience,
  type Difficulty,
  type GeneratedQuestion,
  type QuestionType,
} from "./types";

export interface WriteRequest {
  category: string;
  count: number;
  difficulty: Difficulty;
  audience: Audience;
  types: QuestionType[];
  /** Questions already asked in this category; the AI must not repeat these. */
  avoid: string[];
}

/** The AI side of the question engine, kept behind an interface so tests can swap it out. */
export interface QuestionWriter {
  write(req: WriteRequest): Promise<GeneratedQuestion[]>;
  /** Returns the indexes of questions that are wrong, ambiguous or unsuitable for the players. */
  findProblems(questions: GeneratedQuestion[], audience: Audience): Promise<number[]>;
}

const MODEL = "claude-opus-5-5";
const AVOID_LIMIT = 300;

const TYPE_RULES: Record<QuestionType, string> = {
  multiple_choice:
    'multiple_choice: exactly 4 options, one correct. "answer" must match one option exactly. Make the wrong options believable.',
  true_false: 'true_false: options must be exactly ["True", "False"]. "answer" is "True" or "False".',
  typed:
    'typed: options is []. "answer" is a short answer (1-3 words or a number) that players could easily type. Put other acceptable spellings or forms in "accepted_answers".',
};

const PLAYERS: Record<Audience, string> = {
  kids: "The players are children, roughly 6 to 12 years old. Use simple words and topics children know from school, books, games and cartoons, scaled to the chosen difficulty.",
  family:
    "The players are a family: children and adults playing together. Mix questions so both kids and grown-ups have a fair chance, and avoid topics only adults would know.",
  adults:
    "The players are adults. Use grown-up general knowledge, culture and history, scaled to the chosen difficulty. Keep it friendly and clean, as children may be in the room.",
};

function systemPrompt(audience: Audience): string {
  return `You write questions for Quizcrafter, a team quiz game played on phones.

${PLAYERS[audience]}

Write questions that are fun, clear and have exactly one right answer that is not open to debate. Keep everything family-friendly: nothing rude, scary or upsetting. Avoid questions whose answer changes over time (current records, "latest" anything, living people's ages).`;
}

const AUDIENCE_NOUN: Record<Audience, string> = { kids: "children", family: "a family with children", adults: "adults" };

function writePrompt(req: WriteRequest): string {
  const range = POINTS_RANGE[req.difficulty];
  const avoid = req.avoid.slice(0, AVOID_LIMIT);
  return [
    `Write ${req.count} new ${req.difficulty} questions in the category "${req.category}".`,
    "",
    `Mix these question types: ${req.types.join(", ")}.`,
    ...req.types.map((t) => `- ${TYPE_RULES[t]}`),
    "",
    `Rate each question's own difficulty from 1 to 5 in "difficulty_rating", and give it points between ${range.min} and ${range.max}: harder questions earn more.`,
    'Set "category" to the category name exactly as given. Add a one-sentence "fun_fact" the players would enjoy, shown after the answer.',
    "",
    "Cover a spread of different topics within the category, and don't ask two questions about the same fact.",
    avoid.length > 0
      ? `These questions have already been asked. Don't repeat any of them or ask about the same fact in other words:\n${avoid.map((q) => `- ${q}`).join("\n")}`
      : "",
  ].join("\n");
}

const ReviewSchema = z.object({
  problems: z.array(
    z.object({
      index: z.number().int(),
      reason: z.string(),
    }),
  ),
});

export class ClaudeQuestionWriter implements QuestionWriter {
  constructor(private client: Anthropic = new Anthropic()) {}

  async write(req: WriteRequest): Promise<GeneratedQuestion[]> {
    const response = await this.client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(GeneratedBatchSchema) },
      system: systemPrompt(req.audience),
      messages: [{ role: "user", content: writePrompt(req) }],
    });
    if (response.stop_reason === "refusal") throw new Error("The AI declined to write questions for that category.");
    if (!response.parsed_output) throw new Error("The AI's questions couldn't be read.");
    return response.parsed_output.questions;
  }

  async findProblems(questions: GeneratedQuestion[], audience: Audience): Promise<number[]> {
    if (questions.length === 0) return [];
    const listing = questions
      .map((q, i) =>
        [
          `#${i} [${q.type}] ${q.question}`,
          q.options.length ? `   Options: ${q.options.join(" | ")}` : "",
          `   Given answer: ${q.answer}${q.accepted_answers.length ? ` (also accepts: ${q.accepted_answers.join(", ")})` : ""}`,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n");

    const response = await this.client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(ReviewSchema) },
      system: systemPrompt(audience),
      messages: [
        {
          role: "user",
          content: `Check these quiz questions before ${AUDIENCE_NOUN[audience]} play them. List every question where the given answer is wrong, more than one option could be right, the question is ambiguous or out of date, or the content isn't suitable for the players. Don't list questions that are fine.\n\n${listing}`,
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      // If the check can't run, treat every question as suspect rather than ship unchecked ones.
      return questions.map((_, i) => i);
    }
    return response.parsed_output.problems.map((p) => p.index);
  }
}
