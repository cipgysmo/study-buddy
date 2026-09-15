export interface PlanItemDraft {
  dayIndex: number;
  topic: string;
  instructions: string;
}

export interface PlanDraft {
  title: string;
  items: PlanItemDraft[];
}

/**
 * Prompt that asks the model to produce a strict-JSON day-by-day study plan,
 * grounded in the student's own notes.
 */
export function planGeneratorPrompt(opts: {
  language: string;
  subjectName: string;
  daysAvailable: number;
  targetGrade: string | null;
  context: string;
}): string {
  const lines = [
    "You are an exam-prep planner. Create a day-by-day study plan for a student preparing for an exam.",
    `Respond in ${opts.language}.`,
    `Subject: ${opts.subjectName}.`,
    `There are ${opts.daysAvailable} day(s) available. dayIndex 0 is today; the last dayIndex is the exam day.`,
  ];
  if (opts.targetGrade) lines.push(`Target grade: ${opts.targetGrade}.`);
  lines.push(
    `Create exactly ${opts.daysAvailable} items, one per day, in chronological order (dayIndex 0..${opts.daysAvailable - 1}). Each item has a focused topic and concrete, actionable instructions (what to review, practice, or self-test).`,
    `Return ONLY a JSON object with this shape: {"title": string, "items": [{"dayIndex": number, "topic": string, "instructions": string}]}.`,
    "",
    "<notes>",
    opts.context || "(no notes provided - plan from general knowledge of the subject)",
    "</notes>",
  );
  return lines.join("\n");
}
