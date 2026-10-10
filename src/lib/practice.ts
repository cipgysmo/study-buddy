import { randomUUID } from "node:crypto";
import { LANGUAGES } from "@/i18n/languages";
import { buildSubjectContext } from "./context";
import { getDb } from "./db";
import { cleanDiagramSvg } from "./diagram";
import type { GenerationOptions } from "./generation";
import { resolveLocale } from "./locale";
import { chatJSON } from "./llm";
import { exerciseGeneratorPrompt, type ExerciseDraft } from "./prompts/exercises";
import { trueFalseGeneratorPrompt, type TrueFalseDraft } from "./prompts/truefalse";
import { getSubject } from "./subjects";
import { topicNames } from "./topics";

export interface Exercise {
  id: string;
  subject_id: string;
  prompt: string;
  solution_steps: string[];
  difficulty: string;
  /** Optional standalone SVG figure attached to the exercise. */
  diagram: string | null;
  created_at: string;
}

export interface TrueFalseItem {
  id: string;
  subject_id: string;
  statement: string;
  is_correct: boolean;
  explanation: string;
  created_at: string;
}

type ExerciseRow = Omit<Exercise, "solution_steps"> & { solution_steps: string };
type TrueFalseRow = Omit<TrueFalseItem, "is_correct"> & { is_correct: number };

function shuffleArray<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function parseExercise(row: ExerciseRow): Exercise {
  return { ...row, solution_steps: JSON.parse(row.solution_steps) as string[] };
}

function parseTrueFalse(row: TrueFalseRow): TrueFalseItem {
  return { ...row, is_correct: row.is_correct === 1 };
}

export function listExercises(subjectId?: string): Exercise[] {
  const rows = subjectId
    ? (getDb()
        .prepare("SELECT * FROM exercises WHERE subject_id = ? ORDER BY created_at DESC")
        .all(subjectId) as ExerciseRow[])
    : (getDb().prepare("SELECT * FROM exercises ORDER BY created_at DESC").all() as ExerciseRow[]);
  return rows.map(parseExercise);
}

export function getExercise(id: string): Exercise | null {
  const row = getDb().prepare("SELECT * FROM exercises WHERE id = ?").get(id) as
    | ExerciseRow
    | undefined;
  return row ? parseExercise(row) : null;
}

export function deleteExercise(id: string): void {
  getDb().prepare("DELETE FROM exercises WHERE id = ?").run(id);
}

export async function generateExercises(
  subjectId: string,
  count: number,
  topicIds?: string[],
  opts: GenerationOptions = {}
): Promise<Exercise[]> {
  const subject = getSubject(subjectId);
  if (!subject) throw new Error("subject_not_found");
  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
  const context = buildSubjectContext(subjectId, topicIds, 60000, opts);

  const draft = await chatJSON<ExerciseDraft>({
    messages: [
      {
        role: "user",
        content: exerciseGeneratorPrompt({
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

  const insert = getDb().prepare(
    "INSERT INTO exercises (id, subject_id, prompt, solution_steps, difficulty, diagram) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const created: Exercise[] = [];
  for (const ex of (draft.exercises ?? []).slice(0, count)) {
    if (!ex.prompt) continue;
    const id = randomUUID();
    const steps = Array.isArray(ex.solution_steps)
      ? ex.solution_steps.filter((s) => typeof s === "string" && s.trim())
      : [];
    const diagram = cleanDiagramSvg(ex.diagram);
    insert.run(
      id,
      subjectId,
      ex.prompt,
      JSON.stringify(steps),
      opts.difficulty ?? ex.difficulty ?? "medium",
      diagram
    );
    const saved = getExercise(id);
    if (saved) created.push(saved);
  }
  return created;
}

export function listTrueFalse(subjectId?: string): TrueFalseItem[] {
  const rows = subjectId
    ? (getDb()
        .prepare("SELECT * FROM truefalse WHERE subject_id = ? ORDER BY created_at DESC, rowid DESC")
        .all(subjectId) as TrueFalseRow[])
    : (getDb()
        .prepare("SELECT * FROM truefalse ORDER BY created_at DESC, rowid DESC")
        .all() as TrueFalseRow[]);
  return rows.map(parseTrueFalse);
}

export function getTrueFalse(id: string): TrueFalseItem | null {
  const row = getDb().prepare("SELECT * FROM truefalse WHERE id = ?").get(id) as
    | TrueFalseRow
    | undefined;
  return row ? parseTrueFalse(row) : null;
}

export function deleteTrueFalse(id: string): void {
  getDb().prepare("DELETE FROM truefalse WHERE id = ?").run(id);
}

export async function generateTrueFalse(
  subjectId: string,
  count: number,
  topicIds?: string[],
  opts: GenerationOptions = {}
): Promise<TrueFalseItem[]> {
  const subject = getSubject(subjectId);
  if (!subject) throw new Error("subject_not_found");
  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
  const context = buildSubjectContext(subjectId, topicIds, 60000, opts);

  const draft = await chatJSON<TrueFalseDraft>({
    messages: [
      {
        role: "user",
        content: trueFalseGeneratorPrompt({
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

  const insert = getDb().prepare(
    "INSERT INTO truefalse (id, subject_id, statement, is_correct, explanation) VALUES (?, ?, ?, ?, ?)"
  );
  const created: TrueFalseItem[] = [];
  const items = shuffleArray((draft.items ?? []).slice(0, count));
  for (const item of items) {
    if (!item.statement) continue;
    const id = randomUUID();
    insert.run(id, subjectId, item.statement, item.is_correct ? 1 : 0, item.explanation ?? "");
    const saved = getTrueFalse(id);
    if (saved) created.push(saved);
  }
  return created;
}
