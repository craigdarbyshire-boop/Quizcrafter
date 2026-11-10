import { z } from "zod";
import { AUDIENCES, DIFFICULTIES, QUESTION_TYPES, type Question } from "../questions/types";

export const TIME_LIMITS = [5, 10, 15, 20, 30, 60] as const;
/**
 * "silent" is shown to players as "Normal answers" (one answer per team). The stored value
 * keeps its old name so games saved earlier still load. "mixed" switches per question.
 */
export const ANSWER_MODES = ["silent", "fastest", "mixed"] as const;
export type AnswerMode = (typeof ANSWER_MODES)[number];
/** The mode a single question is played in. */
export type QuestionMode = Exclude<AnswerMode, "mixed">;

export const MODE_LABELS: Record<AnswerMode, string> = {
  silent: "Normal answers",
  fastest: "Fastest finger",
  mixed: "Mixed",
};

/** How long the answer is shown before the next question starts on its own. */
export const REVEAL_SECONDS = 8;
/** A full-screen "fastest finger" warning shows for this long before each fastest finger question. */
export const GET_READY_SECONDS = 3;
/** Every this many questions, the scores are shown full screen before the next question. */
export const STANDINGS_EVERY = 5;
export const STANDINGS_SECONDS = 5;

/** Every player plays for themselves, so the most players is the number of player colours. */
export const MAX_PLAYERS = 10;

export const SettingsSchema = z.object({
  // Games used to have teams. Now every player is their own team, so this is no longer used.
  teams: z.number().int().optional(),
  questions: z.number().int().min(5).max(30),
  timeLimit: z.number().refine((t) => (TIME_LIMITS as readonly number[]).includes(t), "Pick a listed time limit"),
  difficulty: z.enum(DIFFICULTIES),
  // Older games saved before this option existed are treated as family games.
  audience: z.enum(AUDIENCES).default("mixed"),
  types: z.array(z.enum(QUESTION_TYPES)).min(1),
  mode: z.enum(ANSWER_MODES),
  leaderboard: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  questions: 10,
  timeLimit: 10,
  difficulty: "easy",
  audience: "mixed",
  types: ["multiple_choice", "true_false", "typed"],
  mode: "silent",
  leaderboard: false,
};

export const DEFAULT_CATEGORY = "General knowledge";
export const CATEGORY_IDEAS = [
  "General knowledge",
  "Animals",
  "Space",
  "Geography",
  "Sport",
  "Movies and TV",
  "Pop culture",
  "Science and nature",
  "Literature",
  "Music",
  "History",
  "Food",
];

/**
 * Player colours, by team index. Each player is their own team (the "team" number is just
 * that player's slot), and the team's name is the player's name.
 */
export const TEAM_COLORS = ["#ff5a4f", "#3d8bff", "#2fd07f", "#f5b82e", "#a070ff", "#19c3d6", "#ff8a3d", "#ff4f9a", "#9fd843", "#c8d1e6"] as const;

export type Phase = "lobby" | "generating" | "question" | "reveal" | "round_over" | "ended";

export interface Game {
  id: string;
  code: string;
  hostPlayerId: string;
  settings: Settings;
  phase: Phase;
  round: number;
  qIndex: number;
  phaseStartedAt: number; // ms since epoch
  /** Category each player picked, by team index. */
  teamCategories: Record<number, string>;
  /** Names teams chose for themselves, from when games had teams. No longer used. */
  teamNames: Record<number, string>;
  error: string | null;
}

export interface Player {
  id: string;
  gameId: string;
  name: string;
  team: number;
  token: string;
  joinedAt: number;
}

export interface GameQuestion {
  gameId: string;
  round: number;
  idx: number;
  /** The team whose category this question came from. */
  team: number;
  question: Question;
}

export interface Answer {
  gameId: string;
  round: number;
  qIndex: number;
  playerId: string;
  team: number;
  answer: string;
  correct: boolean;
  points: number;
  /** Normal mode: set to the team number so only one answer per team is accepted. */
  teamLock: number | null;
  /** Fastest mode: set to 1 on a correct answer so only the first one wins. */
  winLock: number | null;
  createdAt: number;
}
