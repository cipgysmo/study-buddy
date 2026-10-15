import { randomUUID } from "node:crypto";
import { LANGUAGES } from "@/i18n/languages";
import { getDb } from "./db";
import { cleanDiagramSvg } from "./diagram";
import { resolveLocale } from "./locale";
import { chatJSON } from "./llm";
import { insertQuiz, type Quiz } from "./quizzes";
import { parseExamPrompt, type ParseExamDraft } from "./prompts/parse-exam";
import { similarExamPrompt } from "./prompts/similar-exam";
import type { QuizDraft } from "./prompts/quiz";
import { getMaterial, getMaterialText, getSubject } from "./subjects";

export interface ExamQuestion {
  id: string;
  material_id: string;
  prompt: string;
  options: string[] | null;
  answer: string | null;
  explanation: string | null;
  diagram: string | null;
  sort_order: number;
}

type ExamQuestionRow = Omit<ExamQuestion, "options"> & { options: string | null };

function parseRow(row: ExamQuestionRow): ExamQuestion {
  let options: string[] | null = null;
  if (row.options) {
    try {
      const parsed = JSON.parse(row.options);
      if (Array.isArray(parsed)) options = parsed.filter((o): o is string => typeof o === "string");
    } catch {
      options = null;
    }
  }
  return { ...row, options };
}

export function listExamQuestions(materialId: string): ExamQuestion[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM exam_questions WHERE material_id = ? ORDER BY sort_order ASC, rowid ASC"
    )
    .all(materialId) as ExamQuestionRow[];
  return rows.map(parseRow);
}

function truncateForPrompt(text: string, maxChars = 60_000): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[exam text truncated]`;
}

export function countExamQuestions(materialId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM exam_questions WHERE material_id = ?")
    .get(materialId) as { n: number };
  return row.n;
}

/** Background job: split an exam paper's extracted text into questions. */
export async function parseExam(materialId: string): Promise<number> {
  const m = getMaterial(materialId);
  if (!m) throw new Error("material_not_found");
  const examText = getMaterialText(materialId);
  if (!examText) throw new Error("no_text");
  const subject = getSubject(m.subject_id);
  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;

  const draft = await chatJSON<ParseExamDraft>({
    messages: [
      {
        role: "user",
        content: parseExamPrompt({
          language: languageName,
          subjectName: subject?.name ?? m.filename,
          examText: truncateForPrompt(examText),
        }),
      },
    ],
    temperature: 0.2,
  });

  const db = getDb();
  // Idempotent: a restart may re-run this job after questions were already saved.
  db.prepare("DELETE FROM exam_questions WHERE material_id = ?").run(materialId);
  const insert = db.prepare(
    "INSERT INTO exam_questions (id, material_id, prompt, options, answer, explanation, diagram, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  let order = 0;
  for (const q of draft.questions ?? []) {
    if (!q.prompt?.trim()) continue;
    const options =
      Array.isArray(q.options) && q.options.length > 0
        ? JSON.stringify(q.options.filter((o) => typeof o === "string" && o.trim()))
        : null;
    insert.run(
      randomUUID(),
      materialId,
      q.prompt.trim(),
      options,
      q.answer?.trim() || null,
      q.explanation?.trim() || null,
      cleanDiagramSvg(q.diagram),
      order
    );
    order++;
  }
  return order;
}

/** Background job: generate a NEW timed practice exam mirroring a school exam. */
export async function generateSimilarExam(
  materialId: string,
  count: number,
  durationMin: number,
  customPrompt?: string
): Promise<Quiz> {
  const m = getMaterial(materialId);
  if (!m) throw new Error("material_not_found");
  const examText = getMaterialText(materialId);
  if (!examText) throw new Error("no_text");
  const subject = getSubject(m.subject_id);
  if (!subject) throw new Error("subject_not_found");
  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;

  const draft = await chatJSON<{ title?: string; questions: QuizDraft["questions"] }>({
    messages: [
      {
        role: "user",
        content: similarExamPrompt({
          language: languageName,
          subjectName: subject.name,
          count,
          examText: truncateForPrompt(examText),
          customPrompt,
        }),
      },
    ],
    temperature: 0.5,
  });

  const title = draft.title?.trim() || `Similar to ${m.filename}`;
  return insertQuiz(subject.id, title, durationMin, (draft.questions ?? []).slice(0, count));
}
