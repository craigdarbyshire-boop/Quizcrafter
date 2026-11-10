import { describe, expect, it } from "vitest";
import { DemoQuestionWriter } from "../questions/demo";
import { generateQuestions } from "../questions/engine";
import { MemoryHistoryStore } from "../questions/history";
import {
  createGame,
  getView,
  joinGame,
  nextQuestion,
  planRound,
  roundModes,
  setCategory,
  setTeamName,
  setTeam,
  startRound,
  submitAnswer,
  type GameDeps,
} from "./game";
import { MemoryGameStore } from "./store";
import { DEFAULT_SETTINGS, REVEAL_SECONDS, type Settings } from "./types";

function setup(settings: Partial<Settings> = {}) {
  let clock = 1_000_000;
  const store = new MemoryGameStore();
  const history = new MemoryHistoryStore();
  const writer = new DemoQuestionWriter();
  const deps: GameDeps = {
    store,
    writeQuestions: (req) => generateQuestions(req, { writer, history }),
    now: () => clock,
  };
  const tick = (seconds: number) => (clock += seconds * 1000);
  return { deps, store, tick, settings: { ...DEFAULT_SETTINGS, types: ["multiple_choice" as const], questions: 5, ...settings } };
}

async function lobby(settings: Partial<Settings> = {}) {
  const s = setup(settings);
  const host = await createGame(s.deps, { hostName: "Craig", settings: s.settings });
  const kid = await joinGame(s.deps, host.code.toLowerCase(), { name: "Sam" });
  return { ...s, host, kid, code: host.code };
}

async function currentAnswer(s: Awaited<ReturnType<typeof lobby>>) {
  const game = (await s.store.getGameByCode(s.code))!;
  const qs = await s.store.getQuestions(game.id, game.round);
  return qs[game.qIndex].question;
}

describe("joining", () => {
  it("balances teams and lets the host move players", async () => {
    const s = await lobby();
    let view = await getView(s.deps, s.code, s.host.token);
    expect(view.teams.map((t) => t.players.length)).toEqual([1, 1]);
    await setTeam(s.deps, s.code, s.host.token, { playerId: s.kid.playerId, team: 0 });
    view = await getView(s.deps, s.code, s.host.token);
    expect(view.teams[0].players.map((p) => p.name)).toEqual(["Craig", "Sam"]);
  });

  it("stops non-hosts moving other players or starting", async () => {
    const s = await lobby();
    await expect(setTeam(s.deps, s.code, s.kid.token, { playerId: s.host.playerId, team: 1 })).rejects.toThrow(/host/);
    await expect(startRound(s.deps, s.code, s.kid.token)).rejects.toThrow(/host/);
  });

  it("rejects unknown codes", async () => {
    const s = setup();
    await expect(joinGame(s.deps, "ZZZZ", { name: "x" })).rejects.toThrow(/No game/);
  });
});

describe("team names", () => {
  it("defaults to Team 1, Team 2 and lets each team name itself", async () => {
    const s = await lobby();
    let view = await getView(s.deps, s.code, s.kid.token);
    expect(view.teams.map((t) => t.name)).toEqual(["Team 1", "Team 2"]);
    await setTeamName(s.deps, s.code, s.kid.token, { team: 1, name: "  The   Brainiacs " });
    view = await getView(s.deps, s.code, s.kid.token);
    expect(view.teams[1].name).toBe("The Brainiacs");
    await expect(setTeamName(s.deps, s.code, s.kid.token, { team: 0, name: "Nope" })).rejects.toThrow(/own team/);
    await expect(setTeamName(s.deps, s.code, s.host.token, { team: 0, name: "the brainiacs" })).rejects.toThrow(/already/);
  });
});

describe("planning a round", () => {
  it("splits questions across team categories and takes turns", () => {
    const plan = planRound({ ...DEFAULT_SETTINGS, teams: 3, questions: 7 }, { 0: "Animals", 2: "Space" });
    expect(plan.categories).toEqual([
      { category: "Animals", count: 3 },
      { category: "General knowledge", count: 2 },
      { category: "Space", count: 2 },
    ]);
    expect(plan.order).toEqual([0, 1, 2, 0, 1, 2, 0]);
  });
});

describe("normal answers", () => {
  it("takes one answer per team and hides the answer until the reveal", async () => {
    const s = await lobby();
    await setCategory(s.deps, s.code, s.kid.token, { team: 1, category: "Animals" });
    await startRound(s.deps, s.code, s.host.token);
    let view = await getView(s.deps, s.code, s.host.token);
    expect(view.phase).toBe("question");
    expect(view.question?.answer).toBeNull();

    const q = await currentAnswer(s);
    await submitAnswer(s.deps, s.code, s.host.token, { answer: q.answer });
    await expect(submitAnswer(s.deps, s.code, s.host.token, { answer: "x" })).rejects.toThrow(/already/);
    view = await getView(s.deps, s.code, s.kid.token);
    expect(view.phase).toBe("question"); // Sam's team hasn't answered yet

    await submitAnswer(s.deps, s.code, s.kid.token, { answer: "wrong" });
    view = await getView(s.deps, s.code, s.kid.token);
    expect(view.phase).toBe("reveal");
    expect(view.question?.answer).toBe(q.answer);
    expect(view.teams.map((t) => t.points)).toEqual([q.points, 0]);
  });

  it("moves on when time runs out, then after the reveal", async () => {
    const s = await lobby({ timeLimit: 10 });
    await startRound(s.deps, s.code, s.host.token);
    s.tick(11);
    expect((await getView(s.deps, s.code, s.host.token)).phase).toBe("reveal");
    await expect(submitAnswer(s.deps, s.code, s.kid.token, { answer: "x" })).rejects.toThrow(/time/);
    s.tick(REVEAL_SECONDS + 1);
    const view = await getView(s.deps, s.code, s.host.token);
    expect(view.phase).toBe("question");
    expect(view.question?.index).toBe(1);
  });
});

describe("fastest first", () => {
  it("gives the points to the first right answer and locks out wrong answers", async () => {
    const s = await lobby({ mode: "fastest" });
    const third = await joinGame(s.deps, s.code, { name: "Alex" }); // joins team 0
    await startRound(s.deps, s.code, s.host.token);
    const q = await currentAnswer(s);

    expect(await submitAnswer(s.deps, s.code, s.kid.token, { answer: "nope" })).toEqual({ correct: false });
    await expect(submitAnswer(s.deps, s.code, s.kid.token, { answer: q.answer })).rejects.toThrow(/already/);
    expect((await getView(s.deps, s.code, s.host.token)).phase).toBe("question");

    await submitAnswer(s.deps, s.code, third.token, { answer: q.answer });
    const view = await getView(s.deps, s.code, s.host.token);
    expect(view.phase).toBe("reveal");
    expect(view.question?.winner?.name).toBe("Alex");
    expect(view.teams[0].points).toBe(q.points);
    expect(view.teams[1].points).toBe(0);
  });
});

describe("mixed answer modes", () => {
  it("splits each round about half and half, never three of a kind in a row", () => {
    for (let n = 0; n < 50; n++) {
      for (const questions of [5, 10, 11, 30]) {
        const modes = roundModes({ id: `game-${n}`, round: 1, settings: { ...DEFAULT_SETTINGS, mode: "mixed", questions } });
        expect(modes).toHaveLength(questions);
        const fastest = modes.filter((m) => m === "fastest").length;
        expect(Math.abs(fastest - (questions - fastest))).toBeLessThanOrEqual(1);
        for (let i = 2; i < modes.length; i++) expect(modes[i] === modes[i - 1] && modes[i] === modes[i - 2]).toBe(false);
      }
    }
  });

  it("gives the same mix every time for a round, and a different one next round", () => {
    const game = { id: "abc", round: 1, settings: { ...DEFAULT_SETTINGS, mode: "mixed" as const, questions: 20 } };
    expect(roundModes(game)).toEqual(roundModes(game));
    expect(roundModes(game)).not.toEqual(roundModes({ ...game, round: 2 }));
  });

  it("uses one mode for every question when not mixed", () => {
    expect(new Set(roundModes({ id: "x", round: 1, settings: { ...DEFAULT_SETTINGS, mode: "fastest" } }))).toEqual(new Set(["fastest"]));
  });

  it("plays each question by its own mode", async () => {
    const s = await lobby({ mode: "mixed", questions: 10 });
    await startRound(s.deps, s.code, s.host.token);
    const game = (await s.store.getGameByCode(s.code))!;
    const modes = roundModes(game);
    for (let i = 0; i < 10; i++) {
      const view = await getView(s.deps, s.code, s.host.token);
      expect(view.question?.mode).toBe(modes[i]);
      const q = await currentAnswer(s);
      const result = await submitAnswer(s.deps, s.code, s.host.token, { answer: q.answer });
      if (modes[i] === "fastest") {
        // Fastest finger: the host gets told straight away and the question ends.
        expect(result).toEqual({ correct: true });
        expect((await getView(s.deps, s.code, s.host.token)).phase).toBe("reveal");
      } else {
        // Normal: no feedback yet, and the other team still gets to answer.
        expect(result).toEqual({ correct: undefined });
        expect((await getView(s.deps, s.code, s.host.token)).phase).toBe("question");
        await submitAnswer(s.deps, s.code, s.kid.token, { answer: "wrong" });
      }
      await nextQuestion(s.deps, s.code, s.host.token);
    }
    expect((await getView(s.deps, s.code, s.host.token)).phase).toBe("round_over");
  });
});

describe("rounds and the leaderboard", () => {
  it("plays a round to the end, then a second round with fresh questions", async () => {
    const s = await lobby({ leaderboard: true, questions: 5 });
    await startRound(s.deps, s.code, s.host.token);
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const q = await currentAnswer(s);
      seen.add(q.question);
      await submitAnswer(s.deps, s.code, s.host.token, { answer: q.answer });
      await submitAnswer(s.deps, s.code, s.kid.token, { answer: "wrong" });
      await nextQuestion(s.deps, s.code, s.host.token);
    }
    let view = await getView(s.deps, s.code, s.host.token);
    expect(view.phase).toBe("round_over");
    expect(view.leaderboard?.rounds).toBe(1);
    expect(view.leaderboard?.rows[0]).toMatchObject({ team: 0, wins: 1 });

    await startRound(s.deps, s.code, s.host.token);
    view = await getView(s.deps, s.code, s.host.token);
    expect(view.round).toBe(2);
    expect(view.teams.every((t) => t.points === 0)).toBe(true);
    expect(seen.has((await currentAnswer(s)).question)).toBe(false);
  });

  it("reports a failed question writer and lets the host retry", async () => {
    const s = await lobby();
    s.deps.writeQuestions = async () => {
      throw new Error("AI unavailable");
    };
    await startRound(s.deps, s.code, s.host.token);
    const view = await getView(s.deps, s.code, s.host.token);
    expect(view.phase).toBe("lobby");
    expect(view.error).toMatch(/AI unavailable/);
  });
});
