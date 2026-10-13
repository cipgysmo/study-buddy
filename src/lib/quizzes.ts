import { randomUUID } from "node:crypto";
import { LANGUAGES } from "@/i18n/languages";
import { recordAttempt } from "./attempts";
import { buildSubjectContextWithSources } from "./context";
import { getDb } from "./db";
import { orderBySql, parseListQuery, pagedResult, searchSql, type PagedResult } from "./list-query";
import { cleanDiagramSvg } from "./diagram";
import type { GenerationOptions } from "./generation";
import { resolveLocale } from "./locale";
import { chatJSON } from "./llm";
import { quizGeneratorPrompt, type QuizDraft } from "./prompts/quiz";
import { getSubject } from "./subjects";
import { topicNames } from "./topics";

export interface Quiz {
  id: string;
  subject_id: string;
  title: string;
  created_at: string;
  /** Time limit in minutes; null = untimed. Timed quizzes are mock exams. */
  duration_min: number | null;
  archived_at: string | null;
  source_refs: string | null;
}

export interface Question {
  id: string;
  quiz_id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
  sort_order: number;
  /** Optional standalone SVG figure attached to the question. */
  diagram: string | null;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  score: number;
  total: number;
  answers: string;
  taken_at: string;
}

export function listQuizzes(opts: { subjectId?: string; timed?: boolean; includeArchived?: boolean } = {}): Quiz[] {
  const where: string[] = [];
  const args: unknown[] = [];
  if (!opts.includeArchived) where.push("archived_at IS NULL");
  if (opts.timed) where.push("duration_min IS NOT NULL");
  if (opts.subjectId) {
    where.push("subject_id = ?");
    args.push(opts.subjectId);
  }
  const sql = `SELECT * FROM quizzes ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
  return getDb().prepare(sql).all(...args) as Quiz[];
}

export function listTimedQuizzes(opts: { subjectId?: string; includeArchived?: boolean } = {}): Quiz[] {
  return listQuizzes({ ...opts, timed: true });
}

export function listQuizzesPage(params: URLSearchParams, opts: { timed?: boolean } = {}): PagedResult<Quiz> {
  const q = parseListQuery(params);
  const where: string[] = [];
  const args: unknown[] = [];
  if (!q.includeArchived) where.push("archived_at IS NULL");
  if (opts.timed) where.push("duration_min IS NOT NULL");
  if (q.search) {
    where.push(searchSql(["title"]));
    args.push(`%${q.search.toLowerCase()}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (getDb().prepare(`SELECT COUNT(*) AS n FROM quizzes ${whereSql}`).get(...args) as { n: number }).n;
  const items = getDb()
    .prepare(`SELECT * FROM quizzes ${whereSql} ORDER BY ${orderBySql(q.sort, "title")} LIMIT ? OFFSET ?`)
    .all(...args, q.limit, q.offset) as Quiz[];
  return pagedResult(items, total, q.limit, q.offset);
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
    diagram: r.diagram ?? null,
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

export function setQuizArchived(ids: string[], archived: boolean): number {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => "?").join(",");
  const value = archived ? new Date().toISOString().replace("T", " ").slice(0, 19) : null;
  const info = getDb()
    .prepare(`UPDATE quizzes SET archived_at = ? WHERE id IN (${placeholders})`)
    .run(value, ...ids);
  return info.changes;
}

export async function generateQuiz(
  subjectId: string,
  count: number,
  title?: string,
  durationMin?: number,
  topicIds?: string[],
  opts: GenerationOptions = {}
): Promise<Quiz> {
  const subject = getSubject(subjectId);
  if (!subject) throw new Error("subject_not_found");
  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
  const ctx = buildSubjectContextWithSources(subjectId, topicIds, 60000, opts);
  const context = ctx.text;

  const draft = await chatJSON<QuizDraft>({
    messages: [
      {
        role: "user",
        content: quizGeneratorPrompt({
          language: languageName,
          subjectName: subject.name,
          count,
          context,
          topics: topicNames(topicIds ?? []),
          keywords: opts.keywords,
          difficulty: opts.difficulty,
          customPrompt: opts.customPrompt,
        }),
      },
    ],
    temperature: 0.5,
  });

  return insertQuiz(
    subjectId,
    draft.title?.trim() || title?.trim() || "Quiz",
    durationMin ?? null,
    (draft.questions ?? []).slice(0, count),
    ctx.sources
  );
}

/** Insert a quiz and its questions from a validated draft. Shared by the
 * subject-context and similar-exam generators. */
export function insertQuiz(
  subjectId: string,
  quizTitle: string,
  durationMin: number | null,
  questions: QuizDraft["questions"],
  sourceRefs?: unknown
): Quiz {
  const id = randomUUID();
  const db = getDb();
  db.prepare("INSERT INTO quizzes (id, subject_id, title, duration_min, source_refs) VALUES (?, ?, ?, ?, ?)").run(
    id,
    subjectId,
    quizTitle,
    durationMin,
    sourceRefs ? JSON.stringify(sourceRefs) : null
  );
  const insertQ = db.prepare(
    "INSERT INTO questions (id, quiz_id, prompt, options, correct_index, explanation, diagram, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  let order = 0;
  for (const q of questions) {
    if (!q.prompt || !Array.isArray(q.options) || q.options.length < 2) continue;
    const correctIndex = Math.max(0, Math.min(q.options.length - 1, q.correct_index ?? 0));
    const diagram = cleanDiagramSvg(q.diagram);
    insertQ.run(randomUUID(), id, q.prompt, JSON.stringify(q.options), correctIndex, q.explanation ?? "", diagram, order);
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
  const quiz = getQuiz(quizId);
  recordAttempt({
    subjectId: quiz?.subject_id ?? null,
    kind: "quiz",
    itemId: quizId,
    correct: score === total,
    score: total > 0 ? Math.round((score / total) * 100) : null,
    payload: { score, total },
  });
  return { score, total, attempt };
}
