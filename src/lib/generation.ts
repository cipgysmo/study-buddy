import type { SubjectContextOptions } from "./context";

export type GenerationDifficulty = "balanced" | "easy" | "medium" | "hard" | "expert";

export interface GenerationOptions extends SubjectContextOptions {
  difficulty?: GenerationDifficulty;
}

const DIFFICULTIES: GenerationDifficulty[] = ["balanced", "easy", "medium", "hard", "expert"];

export function cleanDifficulty(value: unknown): GenerationDifficulty {
  return typeof value === "string" && (DIFFICULTIES as string[]).includes(value)
    ? (value as GenerationDifficulty)
    : "balanced";
}
