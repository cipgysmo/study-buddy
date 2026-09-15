import { randomUUID } from "node:crypto";
import { LANGUAGES } from "@/i18n/languages";
import { buildSubjectContext } from "./context";
import { getDb } from "./db";
import { resolveLocale } from "./locale";
import { chatJSON } from "./llm";
import { quizGeneratorPrompt, type QuizDraft } from "./prompts/quiz";
import { getSubject } from "./subjects";

export interface Quiz {
  id: string;
  subject_id: string;
  title: string;
  created_at: string;
}

export interface Question {
  id: string;
  quiz_id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
  sort_order: number;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  score: number;
  total: number;
  answers: string;
  taken_at: string;
}

export function listQuizzes(): Quiz[] {
  return getDb().prepare("SELECT * FROM quizzes ORDER BY created_at DESC").all() as Quiz[];
}

export function getQuiz(id: string): Quiz | null {
  const row = getDb().prepare("SELECT * FROM quizzes WHERE id = ?").get(id) as Quiz | undefined;
  return row ?? null;
}

export function listQuestions(quizId: string): Question[] {
  const rows = getDb()
    .prepare("SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC")
    .all(quizId) as (Omit<Question, "options"> & { options: string })[];
  return rows.map((r) => ({
    id: r.id,
    quiz_id: r.quiz_id,
    prompt: r.prompt,
    options: JSON.parse(r.options) as string[],
    correct_index: r.correct_index,
    explanation: r.explanation,
    sort_order: r.sort_order,
  }));
}

export function listAttempts(quizId: string): QuizAttempt[] {
  return getDb()
    .prepare("SELECT * FROM quiz_attempts WHERE quiz_id = ? ORDER BY taken_at DESC")
    .all(quizId) as QuizAttempt[];
}

export function deleteQuiz(id: string): void {
  getDb().prepare("DELETE FROM quizzes WHERE id = ?").run(id);
}

export async function generateQuiz(
  subjectId: string,
  count: number,
  title?: string
): Promise<Quiz> {
  const subject = getSubject(subjectId);
  if (!subject) throw new Error("subject_not_found");
  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
  const context = buildSubjectContext(subjectId);

  const draft = await chatJSON<QuizDraft>({
    messages: [
      {
        role: "user",
        content: quizGeneratorPrompt({
          language: languageName,
          subjectName: subject.name,
          count,
          context,
        }),
      },
    ],
    temperature: 0.5,
  });

  const id = randomUUID();
  const db = getDb();
  db.prepare("INSERT INTO quizzes (id, subject_id, title) VALUES (?, ?, ?)").run(
    id,
    subjectId,
    draft.title?.trim() || title?.trim() || "Quiz"
  );
  const insertQ = db.prepare(
    "INSERT INTO questions (id, quiz_id, prompt, options, correct_index, explanation, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  let order = 0;
  for (const q of (draft.questions ?? []).slice(0, count)) {
    if (!q.prompt || !Array.isArray(q.options) || q.options.length < 2) continue;
    const correctIndex = Math.max(0, Math.min(q.options.length - 1, q.correct_index ?? 0));
    insertQ.run(randomUUID(), id, q.prompt, JSON.stringify(q.options), correctIndex, q.explanation ?? "", order);
    order++;
  }
  return getQuiz(id)!;
}

export function gradeQuiz(
  quizId: string,
  answers: Record<string, number>
): { score: number; total: number; attempt: QuizAttempt } {
  const questions = listQuestions(quizId);
  let score = 0;
  const answerMap: Record<string, { chosen: number; correct: boolean }> = {};
  for (const q of questions) {
    const chosen = answers[q.id];
    const correct = chosen === q.correct_index;
    if (correct) score++;
    answerMap[q.id] = { chosen: chosen ?? -1, correct };
  }
  const total = questions.length;
  const attemptId = randomUUID();
  getDb()
    .prepare("INSERT INTO quiz_attempts (id, quiz_id, score, total, answers) VALUES (?, ?, ?, ?, ?)")
    .run(attemptId, quizId, score, total, JSON.stringify(answerMap));
  const attempt = getDb()
    .prepare("SELECT * FROM quiz_attempts WHERE id = ?")
    .get(attemptId) as QuizAttempt;
  return { score, total, attempt };
}
