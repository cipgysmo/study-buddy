import { randomUUID } from "node:crypto";
import { LANGUAGES } from "@/i18n/languages";
import { buildSubjectContext } from "./context";
import { getDb } from "./db";
import type { GenerationOptions } from "./generation";
import { resolveLocale } from "./locale";
import { chatJSON } from "./llm";
import {
  typedExerciseGeneratorPrompt,
  typedExerciseGradingPrompt,
  type TypedExerciseDraft,
} from "./prompts/typed-exercises";
import { getSubject } from "./subjects";
import { topicNames } from "./topics";

export type TypedGradingMode = "exact" | "flexible" | "creative";

export interface TypedExercise {
  id: string;
  subject_id: string;
  prompt: string;
  expected_answer: string;
  accepted_answers: string[];
  grading_mode: TypedGradingMode;
  explanation: string;
  difficulty: string;
  created_at: string;
}

export interface TypedGradeResult {
  correct: boolean;
  score: number;
  feedback: string;
}

type TypedExerciseRow = Omit<TypedExercise, "accepted_answers"> & {
  accepted_answers: string;
};

const GRADING_MODES: TypedGradingMode[] = ["exact", "flexible", "creative"];

function cleanGradingMode(value: unknown): TypedGradingMode {
  return typeof value === "string" && (GRADING_MODES as string[]).includes(value)
    ? (value as TypedGradingMode)
    : "flexible";
}

function parseTypedExercise(row: TypedExerciseRow): TypedExercise {
  let acceptedAnswers: string[] = [];
  try {
    acceptedAnswers = JSON.parse(row.accepted_answers) as string[];
  } catch {
    /* ignore */
  }
  return {
    id: row.id,
    subject_id: row.subject_id,
    prompt: row.prompt,
    expected_answer: row.expected_answer,
    accepted_answers: Array.isArray(acceptedAnswers)
      ? acceptedAnswers.filter((x) => typeof x === "string" && x.trim())
      : [],
    grading_mode: cleanGradingMode(row.grading_mode),
    explanation: row.explanation,
    difficulty: row.difficulty,
    created_at: row.created_at,
  };
}

export function listTypedExercises(subjectId?: string): TypedExercise[] {
  const rows = (
    subjectId
      ? getDb()
          .prepare("SELECT * FROM typed_exercises WHERE subject_id = ? ORDER BY created_at DESC")
          .all(subjectId)
      : getDb().prepare("SELECT * FROM typed_exercises ORDER BY created_at DESC").all()
  ) as TypedExerciseRow[];
  return rows.map(parseTypedExercise);
}

export function getTypedExercise(id: string): TypedExercise | null {
  const row = getDb().prepare("SELECT * FROM typed_exercises WHERE id = ?").get(id) as
    | TypedExerciseRow
    | undefined;
  return row ? parseTypedExercise(row) : null;
}

export function deleteTypedExercise(id: string): void {
  getDb().prepare("DELETE FROM typed_exercises WHERE id = ?").run(id);
}

export async function generateTypedExercises(
  subjectId: string,
  count: number,
  topicIds?: string[],
  opts: GenerationOptions = {}
): Promise<TypedExercise[]> {
  const subject = getSubject(subjectId);
  if (!subject) throw new Error("subject_not_found");
  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
  const context = buildSubjectContext(subjectId, topicIds, 60000, opts);

  const draft = await chatJSON<TypedExerciseDraft>({
    messages: [
      {
        role: "user",
        content: typedExerciseGeneratorPrompt({
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
    `INSERT INTO typed_exercises
      (id, subject_id, prompt, expected_answer, accepted_answers, grading_mode, explanation, difficulty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const created: TypedExercise[] = [];
  for (const ex of (draft.exercises ?? []).slice(0, count)) {
    const prompt = ex.prompt?.trim();
    const expectedAnswer = ex.expected_answer?.trim();
    if (!prompt || !expectedAnswer) continue;

    const accepted = Array.from(
      new Set(
        [
          expectedAnswer,
          ...(Array.isArray(ex.accepted_answers)
            ? ex.accepted_answers.filter((x) => typeof x === "string" && x.trim())
            : []),
        ].map((x) => x.trim())
      )
    );
    const id = randomUUID();
    insert.run(
      id,
      subjectId,
      prompt,
      expectedAnswer,
      JSON.stringify(accepted),
      cleanGradingMode(ex.grading_mode),
      ex.explanation?.trim() || "",
      opts.difficulty ?? "medium"
    );
    const saved = getTypedExercise(id);
    if (saved) created.push(saved);
  }
  return created;
}

export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s.,%°/-]/gu, "");
}

export async function gradeTypedExercise(
  id: string,
  answer: string
): Promise<TypedGradeResult> {
  const exercise = getTypedExercise(id);
  if (!exercise) throw new Error("typed_exercise_not_found");

  const studentAnswer = answer.trim();
  if (!studentAnswer) {
    return { correct: false, score: 0, feedback: "Enter an answer." };
  }

  let result: TypedGradeResult;
  if (exercise.grading_mode === "exact") {
    const accepted = [exercise.expected_answer, ...exercise.accepted_answers].map(normalizeAnswer);
    const correct = accepted.includes(normalizeAnswer(studentAnswer));
    result = {
      correct,
      score: correct ? 100 : 0,
      feedback: correct
        ? "Correct."
        : exercise.explanation || "Check the exact wording and try again.",
    };
  } else {
    const locale = await resolveLocale();
    const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
    const subject = getSubject(exercise.subject_id);
    const draft = await chatJSON<{ correct?: boolean; score?: number; feedback?: string }>({
      messages: [
        {
          role: "user",
          content: typedExerciseGradingPrompt({
            language: languageName,
            subjectName: subject?.name ?? "General",
            prompt: exercise.prompt,
            expectedAnswer: exercise.expected_answer,
            acceptedAnswers: exercise.accepted_answers,
            gradingMode: exercise.grading_mode,
            studentAnswer,
          }),
        },
      ],
      temperature: 0.2,
    });

    const score = Math.max(
      0,
      Math.min(100, Math.round(draft.score ?? (draft.correct ? 100 : 0)))
    );
    result = {
      correct: typeof draft.correct === "boolean" ? draft.correct : score >= 70,
      score,
      feedback: draft.feedback?.trim() || exercise.explanation || "",
    };
  }

  getDb()
    .prepare(
      `INSERT INTO typed_attempts
        (id, exercise_id, answer, correct, score, feedback, grading_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      id,
      studentAnswer,
      result.correct ? 1 : 0,
      result.score,
      result.feedback,
      exercise.grading_mode
    );

  return result;
}
