import { randomUUID } from "node:crypto";
import { chat, type ChatMessage } from "./llm";
import { getDb } from "./db";

export interface ArenaSide {
  model: string;
  answer: string;
  error?: string;
}

export interface ArenaResult {
  id: string;
  prompt: string;
  modelA: string;
  modelB: string;
  answerA: string;
  answerB: string;
  winner: "a" | "b" | "tie" | null;
  createdAt: string;
}

export async function runArena(
  messages: ChatMessage[],
  modelA: string,
  modelB: string,
  opts?: { temperature?: number; maxTokens?: number }
): Promise<ArenaResult> {
  const [ra, rb] = await Promise.allSettled([
    chat({ messages, model: modelA, temperature: opts?.temperature, maxTokens: opts?.maxTokens }),
    chat({ messages, model: modelB, temperature: opts?.temperature, maxTokens: opts?.maxTokens }),
  ]);
  const answerA = ra.status === "fulfilled" ? ra.value : "";
  const answerB = rb.status === "fulfilled" ? rb.value : "";

  const id = randomUUID();
  const db = getDb();
  db.prepare(
    `INSERT INTO arena_results (id, prompt, model_a, model_b, answer_a, answer_b)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, lastUserText(messages), modelA, modelB, answerA, answerB);

  return {
    id,
    prompt: lastUserText(messages),
    modelA,
    modelB,
    answerA,
    answerB,
    winner: null,
    createdAt: new Date().toISOString(),
  };
}

function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" && typeof m.content === "string") return m.content;
  }
  return "";
}

export function setArenaWinner(id: string, winner: "a" | "b" | "tie"): void {
  getDb().prepare("UPDATE arena_results SET winner = ? WHERE id = ?").run(winner, id);
}

export function listArenaResults(limit = 20): ArenaResult[] {
  const rows = getDb()
    .prepare("SELECT * FROM arena_results ORDER BY created_at DESC, rowid DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    prompt: r.prompt as string,
    modelA: r.model_a as string,
    modelB: r.model_b as string,
    answerA: r.answer_a as string,
    answerB: r.answer_b as string,
    winner: (r.winner as ArenaResult["winner"]) ?? null,
    createdAt: r.created_at as string,
  }));
}
