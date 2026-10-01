import { DIAGRAM_INSTRUCTION } from "./diagram";

export interface ExerciseDraft {
  exercises: {
    prompt: string;
    solution_steps: string[];
    difficulty: string;
    diagram?: string;
  }[];
}

export function exerciseGeneratorPrompt(opts: {
  language: string;
  subjectName: string;
  count: number;
  context: string;
  topics?: string[];
}): string {
  const lines = [
    `You create practice exercises for a student. Subject: ${opts.subjectName}.`,
    `Respond in ${opts.language}.`,
  ];
  if (opts.topics?.length) lines.push(`Focus on these topics: ${opts.topics.join(", ")}.`);
  lines.push(
    `Create exactly ${opts.count} exercises. Each has a prompt (the task for the student), a step-by-step solution (an array of short steps that lead to the answer), and a difficulty ("easy", "medium", or "hard").`,
    DIAGRAM_INSTRUCTION,
    `Return ONLY a JSON object: {"exercises": [{"prompt": string, "solution_steps": [string], "difficulty": string, "diagram": string}]}. "diagram" is optional.`,
    "",
    "<notes>",
    opts.context || "(no notes provided - use general knowledge of the subject)",
    "</notes>"
  );
  return lines.join("\n");
}
