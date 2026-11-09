import type { Answer, Game, GameQuestion, Player } from "./types";

export type GamePatch = Partial<Pick<Game, "phase" | "round" | "qIndex" | "phaseStartedAt" | "teamCategories" | "error" | "settings">>;

/** Where games live. Supabase in production; memory for local play and tests. */
export interface GameStore {
  createGame(game: Game, host: Player): Promise<void>;
  getGameByCode(code: string): Promise<Game | null>;
  /**
   * Updates the game only if it is still at the expected phase/question/round,
   * so two phones can't both move the game on. Returns whether it applied.
   */
  updateGame(id: string, patch: GamePatch, expect?: Partial<Pick<Game, "phase" | "qIndex" | "round">>): Promise<boolean>;
  getPlayers(gameId: string): Promise<Player[]>;
  addPlayer(player: Player): Promise<void>;
  setPlayerTeam(playerId: string, team: number): Promise<void>;
  setQuestions(questions: GameQuestion[]): Promise<void>;
  getQuestions(gameId: string, round: number): Promise<GameQuestion[]>;
  /** Returns "conflict" when a lock (one answer per team, or first correct wins) is already taken. */
  insertAnswer(answer: Answer): Promise<"ok" | "conflict">;
  getAnswers(gameId: string, round?: number): Promise<Answer[]>;
}

export class MemoryGameStore implements GameStore {
  games = new Map<string, Game>();
  players: Player[] = [];
  questions: GameQuestion[] = [];
  answers: Answer[] = [];

  async createGame(game: Game, host: Player) {
    this.games.set(game.id, structuredClone(game));
    this.players.push({ ...host });
  }
  async getGameByCode(code: string) {
    for (const g of this.games.values()) if (g.code === code) return structuredClone(g);
    return null;
  }
  async updateGame(id: string, patch: GamePatch, expect: Partial<Pick<Game, "phase" | "qIndex" | "round">> = {}) {
    const g = this.games.get(id);
    if (!g) return false;
    for (const [k, v] of Object.entries(expect)) if (g[k as keyof Game] !== v) return false;
    Object.assign(g, structuredClone(patch));
    return true;
  }
  async getPlayers(gameId: string) {
    return this.players.filter((p) => p.gameId === gameId).map((p) => ({ ...p }));
  }
  async addPlayer(player: Player) {
    this.players.push({ ...player });
  }
  async setPlayerTeam(playerId: string, team: number) {
    const p = this.players.find((x) => x.id === playerId);
    if (p) p.team = team;
  }
  async setQuestions(questions: GameQuestion[]) {
    this.questions.push(...structuredClone(questions));
  }
  async getQuestions(gameId: string, round: number) {
    return this.questions.filter((q) => q.gameId === gameId && q.round === round).sort((a, b) => a.idx - b.idx);
  }
  async insertAnswer(answer: Answer) {
    const same = this.answers.filter((a) => a.gameId === answer.gameId && a.round === answer.round && a.qIndex === answer.qIndex);
    if (same.some((a) => a.playerId === answer.playerId)) return "conflict";
    if (answer.teamLock !== null && same.some((a) => a.teamLock === answer.teamLock)) return "conflict";
    if (answer.winLock !== null && same.some((a) => a.winLock === answer.winLock)) return "conflict";
    this.answers.push({ ...answer });
    return "ok";
  }
  async getAnswers(gameId: string, round?: number) {
    return this.answers.filter((a) => a.gameId === gameId && (round === undefined || a.round === round));
  }
}
