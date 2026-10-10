import type { GenerationDifficulty } from "../generation";

export interface FlashcardDraft {
  cards: { front: string; back: string }[];
}

export function flashcardGeneratorPrompt(opts: {
  language: string;
  subjectName: string;
  count: number;
  context: string;
  topics?: string[];
  keywords?: string[];
  difficulty?: GenerationDifficulty;
  customPrompt?: string;
}): string {
  const lines = [
    "/no_think",
    `You create flashcards for a student. Subject: ${opts.subjectName}.`,
    `Respond in ${opts.language}.`,
  ];
  if (opts.topics?.length) lines.push(`Focus on these topics: ${opts.topics.join(", ")}.`);
  if (opts.keywords?.length) lines.push(`Prioritize these keywords: ${opts.keywords.join(", ")}.`);
  if (opts.difficulty) lines.push(`Target difficulty: ${opts.difficulty}.`);
  if (opts.customPrompt)
    lines.push(
      `Additional user request: ${opts.customPrompt}. Follow it unless it conflicts with the required JSON format.`
    );
  lines.push(
    `Create exactly ${opts.count} flashcards based on the notes below. Each card has a concise question or prompt on the front and a clear, correct answer on the back.`,
    `Return ONLY a JSON object: {"cards": [{"front": string, "back": string}]}.`,
    "",
    "<notes>",
    opts.context || "(no notes provided - use general knowledge of the subject)",
    "</notes>"
  );
  return lines.join("\n");
}
