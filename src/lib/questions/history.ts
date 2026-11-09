import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeText } from "./similarity";
import type { Question } from "./types";

export interface PastQuestion {
  category: string;
  question: string;
  answer: string;
}

/** Every question ever asked, so the engine never repeats one. */
export interface HistoryStore {
  /** Past questions in these categories, newest first. */
  list(categories: string[]): Promise<PastQuestion[]>;
  add(questions: Question[]): Promise<void>;
  /** The "reset question history" button. */
  reset(): Promise<void>;
}

export function categoryKey(category: string): string {
  return normalizeText(category);
}

export class MemoryHistoryStore implements HistoryStore {
  private items: PastQuestion[] = [];

  async list(categories: string[]): Promise<PastQuestion[]> {
    const keys = new Set(categories.map(categoryKey));
    return this.items.filter((q) => keys.has(categoryKey(q.category))).reverse();
  }

  async add(questions: Question[]): Promise<void> {
    this.items.push(...questions.map(({ category, question, answer }) => ({ category, question, answer })));
  }

  async reset(): Promise<void> {
    this.items = [];
  }
}

export class SupabaseHistoryStore implements HistoryStore {
  constructor(private db: SupabaseClient) {}

  async list(categories: string[]): Promise<PastQuestion[]> {
    const { data, error } = await this.db
      .from("question_history")
      .select("category, question, answer")
      .in("category_key", categories.map(categoryKey))
      .order("asked_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(`Couldn't load question history: ${error.message}`);
    return data ?? [];
  }

  async add(questions: Question[]): Promise<void> {
    if (questions.length === 0) return;
    const { error } = await this.db.from("question_history").insert(
      questions.map((q) => ({
        category: q.category,
        category_key: categoryKey(q.category),
        question: q.question,
        answer: q.answer,
        type: q.type,
      })),
    );
    if (error) throw new Error(`Couldn't save question history: ${error.message}`);
  }

  async reset(): Promise<void> {
    const { error } = await this.db.from("question_history").delete().gte("id", 0);
    if (error) throw new Error(`Couldn't reset question history: ${error.message}`);
  }
}

/** Server-only: uses the service role key, which must never reach the browser. */
export function historyStoreFromEnv(): HistoryStore {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to store question history.");
  }
  return new SupabaseHistoryStore(createClient(url, key, { auth: { persistSession: false } }));
}
