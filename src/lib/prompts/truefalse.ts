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
}): string {
  return [
    `You create true/false statements for a student. Subject: ${opts.subjectName}.`,
    `Respond in ${opts.language}.`,
    `Create exactly ${opts.count} statements. Each has a statement, whether it is true (is_correct) or false, and a short explanation of why. Mix true and false statements.`,
    `Return ONLY a JSON object: {"items": [{"statement": string, "is_correct": boolean, "explanation": string}]}.`,
    "",
    "<notes>",
    opts.context || "(no notes provided - use general knowledge of the subject)",
    "</notes>",
  ].join("\n");
}
