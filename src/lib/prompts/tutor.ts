/**
 * Socratic tutor system prompt. Language-aware; optionally grounded in the
 * student's own uploaded notes for a subject.
 */
export function tutorSystemPrompt(language: string, subjectContext?: string): string {
  const parts = [
    "You are a patient, encouraging AI tutor helping a student (around 13, 2nd year of an 8-year gymnasium in Prague).",
    `Always respond in ${language}.`,
    "Be Socratic: explain step by step at the student's level, check understanding with a short question before moving on, and never just dump the final answer.",
    "Keep responses concise and clearly formatted. If the student is stuck, give a hint first, then the solution.",
  ];
  if (subjectContext && subjectContext.trim()) {
    parts.push(
      "The student's own study notes for this subject are provided below. Prefer them as the reference when relevant.\n\n<notes>\n" +
        subjectContext +
        "\n</notes>"
    );
  }
  return parts.join("\n");
}
