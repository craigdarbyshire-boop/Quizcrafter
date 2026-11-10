import { randomUUID } from "crypto";
import { isCorrectAnswer } from "../questions/answers";
import { categoryKey } from "../questions/history";
import { normalizeAudience, type GenerateRequest, type Question } from "../questions/types";
import type { GameStore } from "./store";
import {
  DEFAULT_CATEGORY,
  GET_READY_SECONDS,
  MAX_PLAYERS,
  REVEAL_SECONDS,
  SettingsSchema,
  STANDINGS_EVERY,
  STANDINGS_SECONDS,
  TEAM_COLORS,
  type Answer,
  type Game,
  type GameQuestion,
  type Player,
  type QuestionMode,
  type Settings,
} from "./types";

export interface GameDeps {
  store: GameStore;
  writeQuestions: (req: GenerateRequest) => Promise<Question[]>;
  now?: () => number;
}

export class GameError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const GENERATING_TIMEOUT_MS = 6 * 60 * 1000;
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, so codes aren't confused with 1 and 0

function makeCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
  return code;
}

function cleanName(name: unknown): string {
  const n = typeof name === "string" ? name.replace(/\s+/g, " ").trim().slice(0, 20) : "";
  if (!n) throw new GameError("Please enter your name.");
  return n;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

// ---------- Creating and joining ----------

export async function createGame(deps: GameDeps, input: { hostName: unknown; settings: unknown }) {
  const now = deps.now?.() ?? Date.now();
  const parsed = SettingsSchema.safeParse(input.settings);
  if (!parsed.success) throw new GameError("Those game settings aren't valid.");
  const name = cleanName(input.hostName);

  let code = makeCode();
  for (let i = 0; i < 20; i++) {
    const existing = await deps.store.getGameByCode(code);
    if (!existing || existing.phase === "ended") break;
    code = makeCode();
  }

  const gameId = randomUUID();
  const host: Player = { id: randomUUID(), gameId, name, team: 0, token: randomUUID(), joinedAt: now };
  const game: Game = {
    id: gameId,
    code,
    hostPlayerId: host.id,
    settings: parsed.data,
    phase: "lobby",
    round: 1,
    qIndex: 0,
    phaseStartedAt: now,
    teamCategories: {},
    teamNames: {},
    error: null,
  };
  await deps.store.createGame(game, host);
  return { code, playerId: host.id, token: host.token };
}

export async function joinGame(deps: GameDeps, codeIn: string, input: { name: unknown }) {
  const game = await mustGetGame(deps, codeIn);
  if (game.phase === "ended") throw new GameError("That game has finished.");
  const name = cleanName(input.name);
  const players = await deps.store.getPlayers(game.id);
  // Every player is their own team and their name is the team's name, so names must differ.
  if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    throw new GameError("Someone in this game already has that name. Try adding an initial.");
  }
  const taken = new Set(players.map((p) => p.team));
  const team = Array.from({ length: MAX_PLAYERS }, (_, t) => t).find((t) => !taken.has(t));
  if (team === undefined) throw new GameError(`That game is full (${MAX_PLAYERS} players max).`);
  const player: Player = { id: randomUUID(), gameId: game.id, name, team, token: randomUUID(), joinedAt: deps.now?.() ?? Date.now() };
  await deps.store.addPlayer(player);
  return { code: game.code, playerId: player.id, token: player.token };
}

// ---------- Lobby actions ----------

export async function setCategory(deps: GameDeps, codeIn: string, token: string, input: { team: unknown; category: unknown }) {
  const { game, me } = await authed(deps, codeIn, token);
  if (game.phase !== "lobby" && game.phase !== "round_over") throw new GameError("Categories can only change between rounds.");
  const team = Number(input.team);
  const players = await deps.store.getPlayers(game.id);
  if (!players.some((p) => p.team === team)) throw new GameError("No such player.");
  if (me.team !== team && me.id !== game.hostPlayerId) throw new GameError("You can only pick your own category.", 403);
  const category = typeof input.category === "string" ? input.category.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  if (!category) throw new GameError("Please choose a category.");
  await deps.store.updateGame(game.id, { teamCategories: { ...game.teamCategories, [team]: category } });
}

// ---------- Running the game ----------

/** The team numbers in play: one per player, in order. */
export function playingTeams(players: Pick<Player, "team">[]): number[] {
  return [...new Set(players.map((p) => p.team))].sort((a, b) => a - b);
}

/** Splits the game's questions across the players' categories, then takes turns between players. */
export function planRound(settings: Pick<Settings, "questions">, teamCategories: Record<number, string>, teams: number[]) {
  const n = Math.max(teams.length, 1);
  const perTeam = teams.map((_, i) => Math.floor(settings.questions / n) + (i < settings.questions % n ? 1 : 0));
  const categories = perTeam.map((count, i) => ({ category: teamCategories[teams[i]] || DEFAULT_CATEGORY, count })).filter((c) => c.count > 0);
  const order: number[] = [];
  const left = [...perTeam];
  while (order.length < settings.questions) {
    for (let i = 0; i < teams.length; i++) if (left[i]-- > 0) order.push(teams[i]);
  }
  return { categories, order };
}

/** A small seeded random number generator, so every request works out the same mix. */
function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * The answer mode for each question of a round. In a mixed game about half the questions
 * are fastest finger and half normal, shuffled, and never more than two of the same in a row.
 * It's worked out from the game and round, so nothing extra needs saving.
 */
export function roundModes(game: Pick<Game, "id" | "round" | "settings">): QuestionMode[] {
  const count = game.settings.questions;
  if (game.settings.mode !== "mixed") return Array(count).fill(game.settings.mode);
  const rand = seededRandom(`${game.id}:${game.round}`);
  const fastestCount = count % 2 === 1 && rand() < 0.5 ? Math.ceil(count / 2) : Math.floor(count / 2);
  const base: QuestionMode[] = Array.from({ length: count }, (_, i) => (i < fastestCount ? "fastest" : "silent"));
  const threeInARow = (m: QuestionMode[]) => m.some((x, i) => i >= 2 && x === m[i - 1] && x === m[i - 2]);
  for (let attempt = 0; attempt < 2000; attempt++) {
    const modes = [...base];
    for (let i = modes.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [modes[i], modes[j]] = [modes[j], modes[i]];
    }
    if (!threeInARow(modes)) return modes;
  }
  // Practically never reached: plain alternation is always a fair mix.
  return Array.from({ length: count }, (_, i) => ((i % 2 === 0) === fastestCount > count / 2 ? "fastest" : "silent"));
}

/** The answer mode of the question the game is on now. */
export function currentMode(game: Pick<Game, "id" | "round" | "qIndex" | "settings">): QuestionMode {
  return roundModes(game)[game.qIndex] ?? "silent";
}

type Timed = Pick<Game, "id" | "round" | "qIndex" | "settings" | "phaseStartedAt">;

/**
 * When the current question can be answered. A fastest finger question first shows a
 * full-screen warning for a few seconds, and the question stays hidden until it's over.
 */
export function questionOpensAt(game: Timed): number {
  return game.phaseStartedAt + (currentMode(game) === "fastest" ? GET_READY_SECONDS * 1000 : 0);
}

export function questionEndsAt(game: Timed): number {
  return questionOpensAt(game) + game.settings.timeLimit * 1000;
}

/** After every 5th question (but not the last, which has the results screen) the scores show full screen. */
export function showsStandings(game: Pick<Game, "qIndex" | "settings">): boolean {
  const done = game.qIndex + 1;
  return done % STANDINGS_EVERY === 0 && done < game.settings.questions;
}

/** When the scores take over from the answer, if they do after this question. */
function standingsAt(game: Timed): number | null {
  return showsStandings(game) ? game.phaseStartedAt + REVEAL_SECONDS * 1000 : null;
}

/** When the reveal (and the scores, if shown) ends and the game moves on by itself. */
function revealEndsAt(game: Timed): number {
  return game.phaseStartedAt + (REVEAL_SECONDS + (showsStandings(game) ? STANDINGS_SECONDS : 0)) * 1000;
}

export async function startRound(deps: GameDeps, codeIn: string, token: string) {
  const { game } = await authed(deps, codeIn, token, { hostOnly: true });
  if (game.phase !== "lobby" && game.phase !== "round_over") throw new GameError("The game has already started.");
  const round = game.phase === "round_over" ? game.round + 1 : game.round;
  const claimed = await deps.store.updateGame(
    game.id,
    { phase: "generating", round, error: null, phaseStartedAt: deps.now?.() ?? Date.now() },
    { phase: game.phase, round: game.round },
  );
  if (!claimed) return; // another tap got there first

  try {
    const { categories, order } = planRound(game.settings, game.teamCategories, playingTeams(await deps.store.getPlayers(game.id)));
    const written = await deps.writeQuestions({ categories, difficulty: game.settings.difficulty, audience: normalizeAudience(game.settings.audience), types: game.settings.types });
    const queues = new Map<string, Question[]>();
    for (const q of written) {
      const key = categoryKey(q.category);
      queues.set(key, [...(queues.get(key) ?? []), q]);
    }
    const questions: GameQuestion[] = order.map((team, idx) => {
      const key = categoryKey(game.teamCategories[team] || DEFAULT_CATEGORY);
      const q = queues.get(key)?.shift();
      if (!q) throw new Error("Question planning mismatch");
      return { gameId: game.id, round, idx, team, question: q };
    });
    await deps.store.setQuestions(questions);
    await deps.store.updateGame(game.id, { phase: "question", qIndex: 0, phaseStartedAt: deps.now?.() ?? Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    await deps.store.updateGame(game.id, {
      phase: game.phase,
      round: game.round,
      error: `Couldn't write the questions: ${message}`,
    });
  }
}

export async function submitAnswer(deps: GameDeps, codeIn: string, token: string, input: { answer: unknown }) {
  const { game: g0, me } = await authed(deps, codeIn, token);
  const game = await advance(deps, g0);
  if (game.phase !== "question") throw new GameError("Too late, time's up!");
  if ((deps.now?.() ?? Date.now()) < questionOpensAt(game)) throw new GameError("Wait for the question!");
  const text = typeof input.answer === "string" ? input.answer.trim().slice(0, 100) : "";
  if (!text) throw new GameError("Please give an answer.");

  const questions = await deps.store.getQuestions(game.id, game.round);
  const q = questions[game.qIndex]?.question;
  if (!q) throw new GameError("No question right now.");
  const correct = isCorrectAnswer(q, text);
  const fastest = currentMode(game) === "fastest";

  const base: Answer = {
    gameId: game.id,
    round: game.round,
    qIndex: game.qIndex,
    playerId: me.id,
    team: me.team,
    answer: text,
    correct,
    points: 0,
    teamLock: fastest ? null : me.team,
    winLock: null,
    createdAt: deps.now?.() ?? Date.now(),
  };

  let result: "ok" | "conflict";
  if (fastest && correct) {
    result = await deps.store.insertAnswer({ ...base, points: q.points, winLock: 1 });
    // Someone else was right first: record it as a correct-but-late answer.
    if (result === "conflict") result = await deps.store.insertAnswer(base);
  } else {
    result = await deps.store.insertAnswer({ ...base, points: correct && !fastest ? q.points : 0 });
  }
  if (result === "conflict") {
    throw new GameError("You've already answered this one.");
  }
  await advance(deps, game);
  return { correct: fastest ? correct : undefined };
}

export async function nextQuestion(deps: GameDeps, codeIn: string, token: string) {
  const { game: g0 } = await authed(deps, codeIn, token, { hostOnly: true });
  const game = await advance(deps, g0);
  if (game.phase !== "reveal") return;
  const now = deps.now?.() ?? Date.now();
  const scoresAt = standingsAt(game);
  if (scoresAt !== null && now < scoresAt) {
    // Skip the rest of the answer, but still show the scores.
    await deps.store.updateGame(
      game.id,
      { phaseStartedAt: now - REVEAL_SECONDS * 1000 },
      { phase: "reveal", qIndex: game.qIndex, round: game.round },
    );
    return;
  }
  await moveOn(deps, game);
}

export async function endSession(deps: GameDeps, codeIn: string, token: string) {
  const { game } = await authed(deps, codeIn, token, { hostOnly: true });
  await deps.store.updateGame(game.id, { phase: "ended", phaseStartedAt: deps.now?.() ?? Date.now() });
}

async function moveOn(deps: GameDeps, game: Game) {
  const now = deps.now?.() ?? Date.now();
  const last = game.qIndex + 1 >= game.settings.questions;
  if (last) {
    await deps.store.updateGame(game.id, { phase: "round_over", phaseStartedAt: now }, { phase: "reveal", qIndex: game.qIndex, round: game.round });
  } else {
    await deps.store.updateGame(
      game.id,
      { phase: "question", qIndex: game.qIndex + 1, phaseStartedAt: now },
      { phase: "reveal", qIndex: game.qIndex, round: game.round },
    );
  }
}

/** Is everyone done with the current question? */
function everyoneAnswered(game: Game, players: Player[], answers: Answer[]): boolean {
  const here = answers.filter((a) => a.round === game.round && a.qIndex === game.qIndex);
  if (currentMode(game) === "fastest") {
    if (here.some((a) => a.winLock !== null)) return true;
    return players.length > 0 && players.every((p) => here.some((a) => a.playerId === p.id));
  }
  const activeTeams = new Set(players.map((p) => p.team));
  return activeTeams.size > 0 && [...activeTeams].every((t) => here.some((a) => a.team === t));
}

/**
 * Moves the game along when time has run out. There's no server clock ticking,
 * so every request calls this and the game catches up.
 */
export async function advance(deps: GameDeps, game: Game): Promise<Game> {
  const now = deps.now?.() ?? Date.now();
  for (let i = 0; i < 3; i++) {
    if (game.phase === "question") {
      const timeUp = now >= questionEndsAt(game);
      const done =
        timeUp ||
        everyoneAnswered(game, await deps.store.getPlayers(game.id), await deps.store.getAnswers(game.id, game.round));
      if (!done) return game;
      await deps.store.updateGame(game.id, { phase: "reveal", phaseStartedAt: now }, { phase: "question", qIndex: game.qIndex, round: game.round });
    } else if (game.phase === "generating" && now >= game.phaseStartedAt + GENERATING_TIMEOUT_MS) {
      // The request writing questions died; let the host try again.
      const back = game.round > 1 ? { phase: "round_over" as const, round: game.round - 1 } : { phase: "lobby" as const };
      await deps.store.updateGame(game.id, { ...back, error: "Writing the questions took too long. Please try again." }, { phase: "generating", round: game.round });
    } else if (game.phase === "reveal" && now >= revealEndsAt(game)) {
      await moveOn(deps, game);
    } else {
      return game;
    }
    game = (await deps.store.getGameByCode(game.code))!;
  }
  return game;
}

// ---------- What each phone sees ----------

export interface TeamScore {
  team: number;
  name: string;
  color: string;
  points: number;
  players: { id: string; name: string }[];
  category: string;
}

export async function getView(deps: GameDeps, codeIn: string, token: string) {
  const { game: g0, me } = await authed(deps, codeIn, token);
  const game = await advance(deps, g0);
  const now = deps.now?.() ?? Date.now();
  const [players, questions, allAnswers] = await Promise.all([
    deps.store.getPlayers(game.id),
    deps.store.getQuestions(game.id, game.round),
    deps.store.getAnswers(game.id),
  ]);
  const roundAnswers = allAnswers.filter((a) => a.round === game.round);

  // Every player is their own team, named after them.
  const teams: TeamScore[] = playingTeams(players).map((t) => ({
    team: t,
    name: teamName(players, t),
    color: TEAM_COLORS[t % TEAM_COLORS.length],
    points: roundAnswers.filter((a) => a.team === t).reduce((s, a) => s + a.points, 0),
    players: players.filter((p) => p.team === t).map((p) => ({ id: p.id, name: p.name })),
    category: game.teamCategories[t] || DEFAULT_CATEGORY,
  }));

  const current = questions[game.qIndex];
  const showQuestion = game.phase === "question" || game.phase === "reveal";
  const revealing = game.phase === "reveal";
  const here = roundAnswers.filter((a) => a.qIndex === game.qIndex);
  const myAnswer = here.find((a) => a.playerId === me.id) ?? null;
  const teamAnswer = here.find((a) => a.team === me.team && a.teamLock !== null) ?? null;
  const winner = here.find((a) => a.winLock !== null) ?? null;
  const mode = currentMode(game);
  const opensAt = questionOpensAt(game);
  // During the fastest finger warning the question itself stays on the server.
  const gettingReady = game.phase === "question" && now < opensAt;

  const question =
    showQuestion && current
      ? {
          index: game.qIndex,
          total: game.settings.questions,
          text: gettingReady ? "" : current.question.question,
          type: current.question.type,
          options: gettingReady ? [] : current.question.options,
          points: current.question.points,
          category: current.question.category,
          pickedBy: current.team,
          mode,
          opensAt,
          endsAt: questionEndsAt(game),
          // Never send the answer while the question is live.
          answer: revealing ? current.question.answer : null,
          funFact: revealing ? current.question.fun_fact : null,
          answeredTeams: [...new Set(here.map((a) => a.team))],
          answeredPlayers: here.map((a) => a.playerId),
          results: revealing
            ? here.map((a) => ({
                playerId: a.playerId,
                name: players.find((p) => p.id === a.playerId)?.name ?? "?",
                team: a.team,
                answer: a.answer,
                correct: a.correct,
                points: a.points,
              }))
            : null,
          winner: winner ? { playerId: winner.playerId, name: players.find((p) => p.id === winner.playerId)?.name ?? "?", team: winner.team } : null,
        }
      : null;

  return {
    serverNow: now,
    code: game.code,
    phase: game.phase,
    round: game.round,
    error: game.error,
    settings: game.settings,
    revealEndsAt: revealing ? revealEndsAt(game) : null,
    /** When the full-screen scores start, if this reveal ends with them. */
    standingsAt: revealing ? standingsAt(game) : null,
    me: { id: me.id, name: me.name, team: me.team, isHost: me.id === game.hostPlayerId },
    hostName: players.find((p) => p.id === game.hostPlayerId)?.name ?? "",
    teams,
    question,
    mine:
      mode === "fastest"
        ? myAnswer && { answer: myAnswer.answer, by: me.name, correct: myAnswer.correct as boolean | null }
        : teamAnswer && {
            answer: teamAnswer.answer,
            by: players.find((p) => p.id === teamAnswer.playerId)?.name ?? "",
            correct: revealing ? teamAnswer.correct : null,
          },
    leaderboard: game.settings.leaderboard ? leaderboard(game, allAnswers, players) : null,
  };
}

export type GameView = Awaited<ReturnType<typeof getView>>;

/** Round wins and total points across every finished round of the session. */
export function leaderboard(game: Game, answers: Answer[], players: Player[]) {
  const finishedRounds = game.phase === "round_over" || game.phase === "ended" ? game.round : game.round - 1;
  const rows = playingTeams(players).map((t) => ({ team: t, name: teamName(players, t), color: TEAM_COLORS[t % TEAM_COLORS.length] as string, wins: 0, points: 0 }));
  for (let r = 1; r <= finishedRounds; r++) {
    const pts = rows.map((row) => answers.filter((a) => a.round === r && a.team === row.team).reduce((s, a) => s + a.points, 0));
    const best = Math.max(...pts);
    rows.forEach((row, i) => {
      row.points += pts[i];
      if (best > 0 && pts[i] === best) row.wins++;
    });
  }
  return { rounds: finishedRounds, rows: rows.sort((a, b) => b.wins - a.wins || b.points - a.points) };
}

// ---------- Helpers ----------

/** A team's name is its player's name. */
function teamName(players: Player[], team: number): string {
  return players.find((p) => p.team === team)?.name ?? `Player ${team + 1}`;
}

async function mustGetGame(deps: GameDeps, codeIn: string): Promise<Game> {
  const game = await deps.store.getGameByCode(normalizeCode(codeIn));
  if (!game) throw new GameError("No game with that code. Check the letters and try again.", 404);
  return game;
}

async function authed(deps: GameDeps, codeIn: string, token: string, opts: { hostOnly?: boolean } = {}) {
  const game = await mustGetGame(deps, codeIn);
  const players = await deps.store.getPlayers(game.id);
  const me = players.find((p) => p.token === token);
  if (!me) throw new GameError("You're not in this game. Join with the code first.", 401);
  if (opts.hostOnly && me.id !== game.hostPlayerId) throw new GameError("Only the host can do that.", 403);
  return { game, me };
}
