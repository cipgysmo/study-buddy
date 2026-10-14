export type PracticeTab = "exercises" | "truefalse" | "typed";

export function isPracticeTab(value: unknown): value is PracticeTab {
  return value === "exercises" || value === "truefalse" || value === "typed";
}
