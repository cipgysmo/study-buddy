import { randomUUID } from "node:crypto";
import { LANGUAGES } from "@/i18n/languages";
import { buildSubjectContext } from "./context";
import { getDb } from "./db";
import { cleanDiagramSvg } from "./diagram";
import { resolveLocale } from "./locale";
import { chatJSON } from "./llm";
import {
  lessonChapterPrompt,
  lessonOutlinePrompt,
  type CheckUnderstanding,
  type LessonChapterDraft,
  type LessonOutline,
} from "./prompts/lesson";
import { getSubject, listMaterials } from "./subjects";
import { topicNames } from "./topics";

// Character budgets for the notes sent to the model during a lesson build.
const LESSON_OUTLINE_CHARS = 24000;
const LESSON_CHAPTER_CHARS = 12000;

export type LessonStatus = "processing" | "ready" | "failed";

export interface Lesson {
  id: string;
  subject_id: string;
  title: string;
  topic_ids: string[];
  status: LessonStatus;
  error: string | null;
  job_id: string | null;
  created_at: string;
}

export interface LessonChapter {
  id: string;
  lesson_id: string;
  title: string;
  summary: string;
  body: string;
  diagram: string | null;
  check: CheckUnderstanding | null;
  figure_ids: string[];
  sort_order: number;
}

type LessonRow = Omit<Lesson, "topic_ids"> & { topic_ids: string };
type ChapterRow = Omit<LessonChapter, "check" | "figure_ids"> & {
  check_json: string | null;
  figure_ids: string;
};

function parseLesson(row: LessonRow): Lesson {
  let topicIds: string[] = [];
  try {
    topicIds = JSON.parse(row.topic_ids) as string[];
  } catch {
    /* ignore */
  }
  return { ...row, topic_ids: topicIds };
}

function parseChapter(row: ChapterRow): LessonChapter {
  let check: CheckUnderstanding | null = null;
  if (row.check_json) {
    try {
      check = JSON.parse(row.check_json) as CheckUnderstanding;
    } catch {
      /* ignore */
    }
  }
  let figureIds: string[] = [];
  try {
    figureIds = JSON.parse(row.figure_ids) as string[];
  } catch {
    /* ignore */
  }
  return {
    id: row.id,
    lesson_id: row.lesson_id,
    title: row.title,
    summary: row.summary,
    body: row.body,
    diagram: row.diagram,
    check,
    figure_ids: figureIds,
    sort_order: row.sort_order,
  };
}

export function listLessons(subjectId?: string): Lesson[] {
  const db = getDb();
  const rows = (
    subjectId
      ? db.prepare("SELECT * FROM lessons WHERE subject_id = ? ORDER BY created_at DESC").all(subjectId)
      : db.prepare("SELECT * FROM lessons ORDER BY created_at DESC").all()
  ) as LessonRow[];
  return rows.map(parseLesson);
}

export function getLesson(id: string): Lesson | null {
  const row = getDb().prepare("SELECT * FROM lessons WHERE id = ?").get(id) as
    | LessonRow
    | undefined;
  return row ? parseLesson(row) : null;
}

export function listChapters(lessonId: string): LessonChapter[] {
  const rows = getDb()
    .prepare("SELECT * FROM lesson_chapters WHERE lesson_id = ? ORDER BY sort_order ASC, rowid ASC")
    .all(lessonId) as ChapterRow[];
  return rows.map(parseChapter);
}

export function countChapters(lessonId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM lesson_chapters WHERE lesson_id = ?")
    .get(lessonId) as { n: number };
  return row.n;
}

/** Create a lesson shell (status processing) before its build job runs. */
export function createLesson(subjectId: string, topicIds: string[]): Lesson {
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO lessons (id, subject_id, title, topic_ids, status) VALUES (?, ?, ?, ?, 'processing')")
    .run(id, subjectId, "Guided lesson", JSON.stringify(topicIds));
  return getLesson(id)!;
}

export function setLessonJob(lessonId: string, jobId: string): void {
  getDb().prepare("UPDATE lessons SET job_id = ? WHERE id = ?").run(jobId, lessonId);
}

export function setLessonStatus(id: string, status: LessonStatus, error?: string | null): void {
  getDb().prepare("UPDATE lessons SET status = ?, error = ? WHERE id = ?").run(status, error ?? null, id);
}

export function deleteLesson(id: string): void {
  getDb().prepare("DELETE FROM lessons WHERE id = ?").run(id);
}

function cleanCheck(c: CheckUnderstanding | undefined | null): CheckUnderstanding | null {
  if (!c || !c.question?.trim() || !Array.isArray(c.options) || c.options.length < 2) return null;
  const options = c.options.filter((o) => typeof o === "string" && o.trim());
  const answerIndex = Number.isInteger(c.answerIndex) ? c.answerIndex : -1;
  if (answerIndex < 0 || answerIndex >= options.length) return null;
  return {
    question: c.question.trim(),
    options,
    answerIndex,
    explanation: c.explanation?.trim() || "",
  };
}

/**
 * Background job: build a guided lesson from a subject's (optionally
 * topic-filtered) notes. Two passes: outline, then each chapter. Chapters are
 * written incrementally so the reader can show progress. Idempotent: a restart
 * clears and rebuilds the chapters.
 */
export async function generateLesson(lessonId: string): Promise<number> {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error("lesson_not_found");
  const subject = getSubject(lesson.subject_id);
  if (!subject) throw new Error("subject_not_found");

  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
  // Bound the notes sent to the model: a fuller slice for the outline, a smaller
  // one re-sent per chapter (the per-chapter calls are the dominant cost).
  const notes = buildSubjectContext(lesson.subject_id, lesson.topic_ids, LESSON_OUTLINE_CHARS);
  if (!notes.trim()) {
    setLessonStatus(lessonId, "failed", "no_material");
    throw new Error("no_material");
  }
  const chapterNotes = notes.length > LESSON_CHAPTER_CHARS ? notes.slice(0, LESSON_CHAPTER_CHARS) : notes;

  // Pass 1: outline.
  const outline = await chatJSON<LessonOutline>({
    messages: [
      {
        role: "user",
        content: lessonOutlinePrompt({
          language: languageName,
          subjectName: subject.name,
          topicNames: topicNames(lesson.topic_ids),
          notes,
        }),
      },
    ],
    temperature: 0.4,
  });

  const title = outline.title?.trim() || "Guided lesson";
  const chapters = (outline.chapters ?? []).filter((c) => c.title?.trim());
  if (chapters.length === 0) {
    setLessonStatus(lessonId, "failed", "no_chapters");
    throw new Error("no_chapters");
  }

  // Figures: the subject's own uploaded images (notes role), offered to the model.
  const figures = listMaterials(lesson.subject_id)
    .filter((m) => m.kind === "image" && m.role === "notes" && m.status === "ready")
    .slice(0, 12)
    .map((m, i) => ({ index: i, label: m.filename, id: m.id }));

  const db = getDb();
  db.prepare("UPDATE lessons SET title = ? WHERE id = ?").run(title, lessonId);
  // Idempotent: drop any chapters from a previous (possibly interrupted) run.
  db.prepare("DELETE FROM lesson_chapters WHERE lesson_id = ?").run(lessonId);
  const insert = db.prepare(
    "INSERT INTO lesson_chapters (id, lesson_id, title, summary, body, diagram, check_json, figure_ids, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  // Pass 2: fill each chapter, writing as we go.
  let order = 0;
  for (const ch of chapters) {
    const draft = await chatJSON<LessonChapterDraft>({
      messages: [
        {
          role: "user",
          content: lessonChapterPrompt({
            language: languageName,
            subjectName: subject.name,
            lessonTitle: title,
            chapterTitle: ch.title.trim(),
            chapterSummary: ch.summary?.trim() || ch.title.trim(),
            notes: chapterNotes,
            figures: figures.map(({ index, label }) => ({ index, label })),
          }),
        },
      ],
      temperature: 0.5,
    });

    const diagram = cleanDiagramSvg(draft.diagram);
    const check = cleanCheck(draft.check);
    const figureIds = Array.from(
      new Set(
        Array.isArray(draft.figureIndexes)
          ? draft.figureIndexes
              .filter((n) => Number.isInteger(n) && n >= 0 && n < figures.length)
              .map((n) => figures[n].id)
          : []
      )
    );
    insert.run(
      randomUUID(),
      lessonId,
      ch.title.trim(),
      ch.summary?.trim() || "",
      draft.explanation?.trim() || "",
      diagram,
      check ? JSON.stringify(check) : null,
      JSON.stringify(figureIds),
      order
    );
    order++;
  }

  setLessonStatus(lessonId, "ready", null);
  return order;
}
