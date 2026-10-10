import type { GenerationDifficulty } from "../generation";
import { DIAGRAM_INSTRUCTION } from "./diagram";

export interface QuizDraft {
  title: string;
  questions: {
    prompt: string;
    options: string[];
    correct_index: number;
    explanation: string;
    diagram?: string;
  }[];
}

export function quizGeneratorPrompt(opts: {
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
    `You create a multiple-choice quiz for a student. Subject: ${opts.subjectName}.`,
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
    `Create exactly ${opts.count} questions. Each has a prompt, exactly 4 options, the index (0-3) of the correct option, and a clear 2-4 sentence explanation of why the correct option is right and why the other options are wrong.`,
    DIAGRAM_INSTRUCTION,
    `Return ONLY a JSON object: {"title": string, "questions": [{"prompt": string, "options": [string, string, string, string], "correct_index": number, "explanation": string, "diagram": string}]}. "diagram" is optional.`,
    "",
    "<notes>",
    opts.context || "(no notes provided - use general knowledge of the subject)",
    "</notes>"
  );
  return lines.join("\n");
}
