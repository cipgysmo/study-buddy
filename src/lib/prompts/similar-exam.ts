import { DIAGRAM_INSTRUCTION } from "./diagram";

/**
 * Prompt that generates a NEW practice exam mirroring a real school exam:
 * same kinds of exercises and similar difficulty, but different problems.
 */
export function similarExamPrompt(opts: {
  language: string;
  subjectName: string;
  count: number;
  examText: string;
}): string {
  return [
    `You create a practice exam for a student. Subject: ${opts.subjectName}.`,
    `Respond in ${opts.language}.`,
    "A real school exam is provided below. Create a NEW, similar exam: the same kinds of exercises and similar difficulty, but with different specific problems, numbers, and wording. Do not copy the original questions.",
    `Create exactly ${opts.count} multiple-choice questions. Each has a prompt, exactly 4 options, the index (0-3) of the correct option, and a short explanation of why it is correct.`,
    DIAGRAM_INSTRUCTION,
    `Return ONLY a JSON object: {"title": string, "questions": [{"prompt": string, "options": [string, string, string, string], "correct_index": number, "explanation": string, "diagram": string}]}. "diagram" is optional.`,
    "",
    "<exam>",
    opts.examText,
    "</exam>",
  ].join("\n");
}
