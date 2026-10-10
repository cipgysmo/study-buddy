import type { SubjectContextOptions } from "./context";

export type GenerationDifficulty = "balanced" | "easy" | "medium" | "hard" | "expert";

export interface GenerationOptions extends SubjectContextOptions {
  difficulty?: GenerationDifficulty;
  customPrompt?: string;
}

const DIFFICULTIES: GenerationDifficulty[] = ["balanced", "easy", "medium", "hard", "expert"];

export function cleanDifficulty(value: unknown): GenerationDifficulty {
  return typeof value === "string" && (DIFFICULTIES as string[]).includes(value)
    ? (value as GenerationDifficulty)
    : "balanced";
}

export function cleanCustomPrompt(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 2000) : undefined;
}
