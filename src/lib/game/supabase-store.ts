import type { SupabaseClient } from "@supabase/supabase-js";
import type { GamePatch, GameStore } from "./store";
import type { Answer, Game, GameQuestion, Player } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const toGame = (r: any): Game => ({
  id: r.id,
  code: r.code,
  hostPlayerId: r.host_player_id,
  settings: r.settings,
  phase: r.phase,
  round: r.round,
  qIndex: r.q_index,
  phaseStartedAt: new Date(r.phase_started_at).getTime(),
  teamCategories: r.team_categories ?? {},
  error: r.error,
});

const toPlayer = (r: any): Player => ({
  id: r.id,
  gameId: r.game_id,
  name: r.name,
  team: r.team,
  token: r.token,
  joinedAt: new Date(r.joined_at).getTime(),
});

const toAnswer = (r: any): Answer => ({
  gameId: r.game_id,
  round: r.round,
  qIndex: r.q_index,
  playerId: r.player_id,
  team: r.team,
  answer: r.answer,
  correct: r.correct,
  points: r.points,
  teamLock: r.team_lock,
  winLock: r.win_lock,
  createdAt: new Date(r.created_at).getTime(),
});

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export class SupabaseGameStore implements GameStore {
  constructor(private db: SupabaseClient) {}

  async createGame(game: Game, host: Player) {
    const { error } = await this.db.from("games").insert({
      id: game.id,
      code: game.code,
      host_player_id: game.hostPlayerId,
      settings: game.settings,
      phase: game.phase,
      round: game.round,
      q_index: game.qIndex,
      phase_started_at: new Date(game.phaseStartedAt).toISOString(),
      team_categories: game.teamCategories,
      error: game.error,
    });
    check(error, "Couldn't create the game");
    await this.addPlayer(host);
  }

  async getGameByCode(code: string) {
    const { data, error } = await this.db
      .from("games")
      .select("*")
      .eq("code", code)
      .order("created_at", { ascending: false })
      .limit(1);
    check(error, "Couldn't load the game");
    return data?.[0] ? toGame(data[0]) : null;
  }

  async updateGame(id: string, patch: GamePatch, expect: Partial<Pick<Game, "phase" | "qIndex" | "round">> = {}) {
    const row: Record<string, unknown> = {};
    if (patch.phase !== undefined) row.phase = patch.phase;
    if (patch.round !== undefined) row.round = patch.round;
    if (patch.qIndex !== undefined) row.q_index = patch.qIndex;
    if (patch.phaseStartedAt !== undefined) row.phase_started_at = new Date(patch.phaseStartedAt).toISOString();
    if (patch.teamCategories !== undefined) row.team_categories = patch.teamCategories;
    if (patch.error !== undefined) row.error = patch.error;
    if (patch.settings !== undefined) row.settings = patch.settings;
    let q = this.db.from("games").update(row).eq("id", id);
    if (expect.phase !== undefined) q = q.eq("phase", expect.phase);
    if (expect.qIndex !== undefined) q = q.eq("q_index", expect.qIndex);
    if (expect.round !== undefined) q = q.eq("round", expect.round);
    const { data, error } = await q.select("id");
    check(error, "Couldn't update the game");
    return (data?.length ?? 0) > 0;
  }

  async getPlayers(gameId: string) {
    const { data, error } = await this.db.from("players").select("*").eq("game_id", gameId).order("joined_at");
    check(error, "Couldn't load players");
    return (data ?? []).map(toPlayer);
  }

  async addPlayer(p: Player) {
    const { error } = await this.db.from("players").insert({
      id: p.id,
      game_id: p.gameId,
      name: p.name,
      team: p.team,
      token: p.token,
      joined_at: new Date(p.joinedAt).toISOString(),
    });
    check(error, "Couldn't add the player");
  }

  async setPlayerTeam(playerId: string, team: number) {
    const { error } = await this.db.from("players").update({ team }).eq("id", playerId);
    check(error, "Couldn't change team");
  }

  async setQuestions(questions: GameQuestion[]) {
    const { error } = await this.db.from("game_questions").insert(
      questions.map((q) => ({ game_id: q.gameId, round: q.round, idx: q.idx, team: q.team, question: q.question })),
    );
    check(error, "Couldn't save the questions");
  }

  async getQuestions(gameId: string, round: number) {
    const { data, error } = await this.db.from("game_questions").select("*").eq("game_id", gameId).eq("round", round).order("idx");
    check(error, "Couldn't load the questions");
    return (data ?? []).map((r: any) => ({ gameId: r.game_id, round: r.round, idx: r.idx, team: r.team, question: r.question }));
  }

  async insertAnswer(a: Answer) {
    const { error } = await this.db.from("answers").insert({
      game_id: a.gameId,
      round: a.round,
      q_index: a.qIndex,
      player_id: a.playerId,
      team: a.team,
      answer: a.answer,
      correct: a.correct,
      points: a.points,
      team_lock: a.teamLock,
      win_lock: a.winLock,
    });
    // 23505 = unique violation: the answer lock was already taken.
    if (error && (error as any).code === "23505") return "conflict";
    check(error, "Couldn't save the answer");
    return "ok";
  }

  async getAnswers(gameId: string, round?: number) {
    let q = this.db.from("answers").select("*").eq("game_id", gameId);
    if (round !== undefined) q = q.eq("round", round);
    const { data, error } = await q.order("created_at");
    check(error, "Couldn't load answers");
    return (data ?? []).map(toAnswer);
  }
}
