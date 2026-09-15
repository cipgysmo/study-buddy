export interface QuizDraft {
  title: string;
  questions: {
    prompt: string;
    options: string[];
    correct_index: number;
    explanation: string;
  }[];
}

export function quizGeneratorPrompt(opts: {
  language: string;
  subjectName: string;
  count: number;
  context: string;
}): string {
  return [
    `You create a multiple-choice quiz for a student. Subject: ${opts.subjectName}.`,
    `Respond in ${opts.language}.`,
    `Create exactly ${opts.count} questions. Each has a prompt, exactly 4 options, the index (0-3) of the correct option, and a short explanation of why it is correct.`,
    `Return ONLY a JSON object: {"title": string, "questions": [{"prompt": string, "options": [string, string, string, string], "correct_index": number, "explanation": string}]}.`,
    "",
    "<notes>",
    opts.context || "(no notes provided - use general knowledge of the subject)",
    "</notes>",
  ].join("\n");
}
