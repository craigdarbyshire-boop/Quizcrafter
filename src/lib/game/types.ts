import { z } from "zod";
import { AUDIENCES, DIFFICULTIES, QUESTION_TYPES, type Question } from "../questions/types";

export const TIME_LIMITS = [5, 10, 15, 20, 30, 60] as const;
export const ANSWER_MODES = ["fastest", "silent"] as const;
export type AnswerMode = (typeof ANSWER_MODES)[number];

/** How long the answer is shown before the next question starts on its own. */
export const REVEAL_SECONDS = 8;

export const SettingsSchema = z.object({
  teams: z.number().int().min(2).max(10),
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
  teams: 2,
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

/** Team colours, by team index. Teams pick their own names; until then they're "Team 1", "Team 2"… */
export const TEAM_COLORS = ["#ff5a4f", "#3d8bff", "#2fd07f", "#f5b82e", "#a070ff", "#19c3d6", "#ff8a3d", "#ff4f9a", "#9fd843", "#c8d1e6"] as const;

export function teamName(names: Record<number, string> | undefined, team: number): string {
  return names?.[team] || `Team ${team + 1}`;
}

export const TEAM_NAME_MAX = 24;

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
  /** Category each team picked, by team index. */
  teamCategories: Record<number, string>;
  /** Names teams chose for themselves, by team index. */
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
  /** Silent mode: set to the team number so only one answer per team is accepted. */
  teamLock: number | null;
  /** Fastest mode: set to 1 on a correct answer so only the first one wins. */
  winLock: number | null;
  createdAt: number;
}
