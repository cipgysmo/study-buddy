export interface FlashcardDraft {
  cards: { front: string; back: string }[];
}

export function flashcardGeneratorPrompt(opts: {
  language: string;
  subjectName: string;
  count: number;
  context: string;
}): string {
  return [
    `You create flashcards for a student. Subject: ${opts.subjectName}.`,
    `Respond in ${opts.language}.`,
    `Create exactly ${opts.count} flashcards based on the notes below. Each card has a concise question or prompt on the front and a clear, correct answer on the back.`,
    `Return ONLY a JSON object: {"cards": [{"front": string, "back": string}]}.`,
    "",
    "<notes>",
    opts.context || "(no notes provided - use general knowledge of the subject)",
    "</notes>",
  ].join("\n");
}
