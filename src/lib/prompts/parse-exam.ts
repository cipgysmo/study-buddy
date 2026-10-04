export interface ParsedQuestion {
  prompt: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  diagram?: string;
}

export interface ParseExamDraft {
  questions: ParsedQuestion[];
}

/**
 * Prompt that transcribes a real school exam into structured questions so the
 * student can view, get explanations for, and study the original paper.
 */
export function parseExamPrompt(opts: {
  language: string;
  subjectName: string;
  examText: string;
}): string {
  return [
    "/no_think",
    `You are transcribing a real school exam for the subject ${opts.subjectName}.`,
    `Respond in ${opts.language}.`,
    "Split the exam below into its individual questions, in the order they appear. For each question provide:",
    '- "prompt": the full question text (what the student must do).',
    '- "options": ONLY if the question is multiple choice, the list of answer options. Omit this field otherwise.',
    '- "answer": the correct answer, or a concise model solution.',
    '- "explanation": a clear 2-4 sentence explanation of why the answer is correct.',
    '- "diagram": OPTIONAL. If the question refers to a figure, a complete standalone SVG (viewBox="0 0 400 300", stroke="currentColor" fill="none" for shapes, fill="currentColor" font-size="14" for labels) showing ONLY the given information. Never include the answer or the value the question asks to find in the diagram.',
    `Return ONLY a JSON object: {"questions": [{"prompt": string, "options": [string], "answer": string, "explanation": string, "diagram": string}]}.`,
    "",
    "<exam>",
    opts.examText,
    "</exam>",
  ].join("\n");
}
