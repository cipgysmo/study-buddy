export interface ExerciseDraft {
  exercises: {
    prompt: string;
    solution_steps: string[];
    difficulty: string;
  }[];
}

export function exerciseGeneratorPrompt(opts: {
  language: string;
  subjectName: string;
  count: number;
  context: string;
}): string {
  return [
    `You create practice exercises for a student. Subject: ${opts.subjectName}.`,
    `Respond in ${opts.language}.`,
    `Create exactly ${opts.count} exercises. Each has a prompt (the task for the student), a step-by-step solution (an array of short steps that lead to the answer), and a difficulty ("easy", "medium", or "hard").`,
    `Return ONLY a JSON object: {"exercises": [{"prompt": string, "solution_steps": [string], "difficulty": string}]}.`,
    "",
    "<notes>",
    opts.context || "(no notes provided - use general knowledge of the subject)",
    "</notes>",
  ].join("\n");
}
