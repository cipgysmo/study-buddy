import type { GenerationDifficulty } from "../generation";

export interface TrueFalseDraft {
  items: {
    statement: string;
    is_correct: boolean;
    explanation: string;
  }[];
}

export function trueFalseGeneratorPrompt(opts: {
  language: string;
  subjectName: string;
  count: number;
  context: string;
  topics?: string[];
  keywords?: string[];
  difficulty?: GenerationDifficulty;
}): string {
  const lines = [
    "/no_think",
    `You create true/false statements for a student. Subject: ${opts.subjectName}.`,
    `Respond in ${opts.language}.`,
  ];
  if (opts.topics?.length) lines.push(`Focus on these topics: ${opts.topics.join(", ")}.`);
  if (opts.keywords?.length) lines.push(`Prioritize these keywords: ${opts.keywords.join(", ")}.`);
  if (opts.difficulty) lines.push(`Target difficulty: ${opts.difficulty}.`);
  lines.push(
    `Create exactly ${opts.count} statements. Each has a statement, whether it is true (is_correct) or false, and a clear 2-4 sentence explanation of why. Mix true and false statements. Randomize which statements are true and which are false. Do not alternate true/false, and do not create any predictable position pattern.`,
    `Return ONLY a JSON object: {"items": [{"statement": string, "is_correct": boolean, "explanation": string}]}.`,
    "",
    "<notes>",
    opts.context || "(no notes provided - use general knowledge of the subject)",
    "</notes>"
  );
  return lines.join("\n");
}
