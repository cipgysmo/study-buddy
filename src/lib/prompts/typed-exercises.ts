import type { GenerationDifficulty } from "../generation";

export interface TypedExerciseDraft {
  exercises: {
    prompt: string;
    expected_answer: string;
    accepted_answers?: string[];
    grading_mode?: string;
    explanation?: string;
  }[];
}

export function typedExerciseGeneratorPrompt(opts: {
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
    `You create typed-answer exercises for a student. Subject: ${opts.subjectName}.`,
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
    `Create exactly ${opts.count} exercises where the student types an answer.`,
    `Use grading_mode "exact" for short factual answers where spelling/wording matters, "flexible" for answers that can be paraphrased, and "creative" for open-ended literature/history/essay-like answers.`,
    `For each exercise include: prompt, expected_answer, accepted_answers (array of acceptable short variants or key ideas; include expected_answer), grading_mode, and explanation.`,
    `Return ONLY a JSON object: {"exercises": [{"prompt": string, "expected_answer": string, "accepted_answers": [string], "grading_mode": "exact" | "flexible" | "creative", "explanation": string}]}.`,
    "",
    "<notes>",
    opts.context || "(no notes provided - use general knowledge of the subject)",
    "</notes>"
  );
  return lines.join("\n");
}

export function typedExerciseGradingPrompt(opts: {
  language: string;
  subjectName: string;
  prompt: string;
  expectedAnswer: string;
  acceptedAnswers: string[];
  gradingMode: "exact" | "flexible" | "creative";
  studentAnswer: string;
}): string {
  return [
    "/no_think",
    `You grade a student's typed answer for a ${opts.gradingMode} exercise. Subject: ${opts.subjectName}.`,
    `Respond in ${opts.language}.`,
    `Exercise: ${opts.prompt}`,
    `Expected answer: ${opts.expectedAnswer}`,
    `Accepted answers or key ideas: ${opts.acceptedAnswers.join(" | ") || opts.expectedAnswer}`,
    `Student answer: ${opts.studentAnswer}`,
    opts.gradingMode === "flexible"
      ? "Be flexible about wording. Accept semantically equivalent answers, minor spelling differences, and reasonable paraphrases."
      : "For creative answers, grade relevance, correctness, completeness, and clarity. Do not require an exact wording match.",
    `Return ONLY a JSON object: {"correct": boolean, "score": number, "feedback": string}. score is 0-100. feedback is short and helpful.`,
  ].join("\n");
}
