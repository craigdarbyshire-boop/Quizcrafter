import { z } from "zod";
import { DIFFICULTIES, QUESTION_TYPES, type Question } from "../questions/types";

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
  types: ["multiple_choice", "true_false", "typed"],
  mode: "silent",
  leaderboard: false,
};

export const DEFAULT_CATEGORY = "General knowledge";
export const CATEGORY_IDEAS = [
  "General knowledge",
  "Animals",
  "Science",
  "Space",
  "Geography",
  "Sport",
  "Movies and TV",
  "Music",
  "History",
  "Food",
];

/** Fun team identities. Index = team number. */
export const TEAMS = [
  { name: "Rockets", emoji: "🚀", color: "#ff5a5f" },
  { name: "Unicorns", emoji: "🦄", color: "#b46cff" },
  { name: "Dragons", emoji: "🐉", color: "#2ed47a" },
  { name: "Sharks", emoji: "🦈", color: "#38b6ff" },
  { name: "Tigers", emoji: "🐯", color: "#ff9f1c" },
  { name: "Aliens", emoji: "👽", color: "#9be564" },
  { name: "Ninjas", emoji: "🥷", color: "#5c6bff" },
  { name: "Pandas", emoji: "🐼", color: "#f15bb5" },
  { name: "Wizards", emoji: "🧙", color: "#00c2c7" },
  { name: "Robots", emoji: "🤖", color: "#ffd60a" },
] as const;

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
