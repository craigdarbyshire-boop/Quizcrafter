import { describe, expect, it } from "vitest";
import type { QuestionWriter, WriteRequest } from "./ai";
import { isCorrectAnswer } from "./answers";
import { generateQuestions, QuestionEngineError, tidyQuestion } from "./engine";
import { MemoryHistoryStore } from "./history";
import { fingerprint, isDuplicate } from "./similarity";
import { normalizeAudience, type GenerateRequest, type GeneratedQuestion } from "./types";

function mc(question: string, answer: string, extra: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  const options = [answer, "Wrong A", "Wrong B", "Wrong C"];
  return {
    category: "Animals",
    type: "multiple_choice",
    question,
    options,
    answer,
    accepted_answers: [],
    difficulty_rating: 2,
    points: 12,
    fun_fact: "Fun!",
    ...extra,
  };
}

/** A fake AI that hands out questions from a fixed pool, in order. */
class FakeWriter implements QuestionWriter {
  requests: WriteRequest[] = [];
  constructor(private pool: GeneratedQuestion[], private problems: string[] = []) {}
  async write(req: WriteRequest) {
    this.requests.push(req);
    return this.pool.splice(0, req.count);
  }
  async findProblems(qs: GeneratedQuestion[]) {
    return qs.flatMap((q, i) => (this.problems.includes(q.question) ? [i] : []));
  }
}

const baseReq: GenerateRequest = {
  categories: [{ category: "Animals", count: 2 }],
  difficulty: "easy",
  types: ["multiple_choice", "true_false", "typed"],
};

describe("duplicate detection", () => {
  it("catches reworded repeats with the same answer", () => {
    const a = fingerprint("What is the largest animal on Earth?", "Blue whale");
    const b = fingerprint("Which animal is the largest on the Earth?", "Blue whale");
    expect(isDuplicate(a, b)).toBe(true);
  });

  it("keeps different questions that share an answer", () => {
    const a = fingerprint("What is the largest animal on Earth?", "Blue whale");
    const b = fingerprint("Which sea creature has a heart the size of a small car?", "Blue whale");
    expect(isDuplicate(a, b)).toBe(false);
  });

  it("doesn't treat all true/false questions as the same", () => {
    const a = fingerprint("Spiders are insects.", "False");
    const b = fingerprint("Bats are blind.", "False");
    expect(isDuplicate(a, b)).toBe(false);
  });
});

describe("answer checking", () => {
  const typed = { type: "typed" as const, answer: "Jupiter", accepted_answers: ["planet Jupiter"] };
  it("forgives case, punctuation and small typos in typed answers", () => {
    expect(isCorrectAnswer(typed, "jupiter!")).toBe(true);
    expect(isCorrectAnswer(typed, "Jupitor")).toBe(true);
    expect(isCorrectAnswer(typed, "Planet Jupiter")).toBe(true);
    expect(isCorrectAnswer(typed, "Saturn")).toBe(false);
    expect(isCorrectAnswer(typed, "")).toBe(false);
  });
  it("requires exact numbers", () => {
    expect(isCorrectAnswer({ type: "typed", answer: "1066", accepted_answers: [] }, "1065")).toBe(false);
  });
  it("matches multiple choice exactly", () => {
    const q = { type: "multiple_choice" as const, answer: "Blue whale", accepted_answers: [] };
    expect(isCorrectAnswer(q, "blue whale")).toBe(true);
    expect(isCorrectAnswer(q, "Orca")).toBe(false);
  });
});

describe("tidyQuestion", () => {
  it("clamps points to the difficulty's range", () => {
    expect(tidyQuestion(mc("Q?", "A", { points: 99 }), baseReq, "Animals")?.points).toBe(15);
    expect(tidyQuestion(mc("Q?", "A", { points: 1 }), { ...baseReq, difficulty: "hard" }, "Animals")?.points).toBe(20);
  });
  it("drops multiple choice whose answer isn't an option", () => {
    expect(tidyQuestion({ ...mc("Q?", "A"), answer: "Z" }, baseReq, "Animals")).toBeNull();
  });
  it("drops question types the game didn't ask for", () => {
    expect(tidyQuestion(mc("Q?", "A"), { ...baseReq, types: ["typed"] }, "Animals")).toBeNull();
  });
  it("normalises true/false answers", () => {
    const tf = tidyQuestion(
      { ...mc("Cats can see in the dark.", "x"), type: "true_false", options: [], answer: "true" },
      baseReq,
      "Animals",
    );
    expect(tf?.options).toEqual(["True", "False"]);
    expect(tf?.answer).toBe("True");
  });
});

describe("generateQuestions", () => {
  it("never repeats a question from history, and saves new ones", async () => {
    const history = new MemoryHistoryStore();
    const writer1 = new FakeWriter([mc("What is the largest animal on Earth?", "Blue whale"), mc("How many legs does a spider have?", "8")]);
    await generateQuestions(baseReq, { writer: writer1, history });

    const writer2 = new FakeWriter([
      mc("Which animal is the largest on the Earth?", "Blue whale"), // reworded repeat
      mc("What do pandas mostly eat?", "Bamboo"),
      mc("Which bird can fly backwards?", "Hummingbird"),
    ]);
    const second = await generateQuestions(baseReq, { writer: writer2, history });
    expect(second.map((q) => q.question)).toEqual(["What do pandas mostly eat?", "Which bird can fly backwards?"]);
    expect(writer2.requests[0].avoid).toContain("What is the largest animal on Earth?");
    expect(await history.list(["animals"])).toHaveLength(4);
  });

  it("tells the AI who's playing, defaulting to mixed", async () => {
    const pool = () => [mc("Q one about owls?", "A"), mc("Q two about frogs?", "B")];
    const w1 = new FakeWriter(pool());
    await generateQuestions(baseReq, { writer: w1, history: new MemoryHistoryStore() });
    expect(w1.requests[0].audience).toBe("mixed");
    const w2 = new FakeWriter(pool());
    await generateQuestions({ ...baseReq, audience: "adults" }, { writer: w2, history: new MemoryHistoryStore() });
    expect(w2.requests[0].audience).toBe("adults");
    const w3 = new FakeWriter(pool());
    await generateQuestions({ ...baseReq, audience: "children" }, { writer: w3, history: new MemoryHistoryStore() });
    expect(w3.requests[0].audience).toBe("children");
  });

  it("keeps the kids (13 and under) option, and still loads old games", () => {
    expect(normalizeAudience("children")).toBe("children");
    expect(normalizeAudience("kids")).toBe("teens"); // the old name for the 14+ option
    expect(normalizeAudience(undefined)).toBe("mixed");
  });

  it("replaces questions that fail the accuracy check", async () => {
    const writer = new FakeWriter(
      [mc("Bad question?", "X"), mc("Good one?", "Y"), mc("Another good one?", "Z")],
      ["Bad question?"],
    );
    const qs = await generateQuestions(baseReq, { writer, history: new MemoryHistoryStore() });
    expect(qs.map((q) => q.question)).toEqual(["Good one?", "Another good one?"]);
  });

  it("gives two teams with the same category different questions", async () => {
    const writer = new FakeWriter([mc("Q1 about owls?", "A1"), mc("Q2 about frogs?", "A2"), mc("Q3 about bees?", "A3"), mc("Q4 about cows?", "A4"), mc("Q5 about eels?", "A5")]);
    const qs = await generateQuestions(
      { ...baseReq, categories: [{ category: "Animals", count: 2 }, { category: "animals ", count: 2 }] },
      { writer, history: new MemoryHistoryStore() },
    );
    expect(new Set(qs.map((q) => q.question)).size).toBe(4);
  });

  it("explains when it runs out of new questions", async () => {
    const writer = new FakeWriter([mc("Only one?", "A")]);
    await expect(generateQuestions(baseReq, { writer, history: new MemoryHistoryStore() })).rejects.toBeInstanceOf(
      QuestionEngineError,
    );
  });
});
