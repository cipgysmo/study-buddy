import { getDb } from "./db";
import { listExercisesBySet, listTrueFalseBySet } from "./practice";
import { listTypedExercisesBySet } from "./typed-exercises";

export type PracticeSetKind = "exercises" | "truefalse" | "typed" | "mixed";

export interface PracticeSet {
  id: string;
  subject_id: string;
  kind: PracticeSetKind;
  title: string;
  status: string;
  error: string | null;
  job_id: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
}

export interface PracticeSetItems {
  exercises: ReturnType<typeof listExercisesBySet>;
  items: ReturnType<typeof listTrueFalseBySet>;
  typedExercises: ReturnType<typeof listTypedExercisesBySet>;
}

const KINDS: PracticeSetKind[] = ["exercises", "truefalse", "typed", "mixed"];

function cleanKind(value: unknown): PracticeSetKind {
  return typeof value === "string" && (KINDS as string[]).includes(value)
    ? (value as PracticeSetKind)
    : "mixed";
}

export function cleanPracticeKinds(value: unknown): Exclude<PracticeSetKind, "mixed">[] {
  const allowed: Exclude<PracticeSetKind, "mixed">[] = ["exercises", "truefalse", "typed"];
  if (!Array.isArray(value)) return ["exercises"];
  const kinds = value.filter((x): x is Exclude<PracticeSetKind, "mixed"> =>
    typeof x === "string" && (allowed as string[]).includes(x)
  );
  return kinds.length > 0 ? kinds : ["exercises"];
}

export function ensurePracticeSet(
  id: string,
  subjectId: string,
  kind: PracticeSetKind,
  jobId?: string,
  title = ""
): PracticeSet {
  getDb()
    .prepare(
      `INSERT INTO practice_sets (id, subject_id, kind, title, job_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         subject_id = excluded.subject_id,
         kind = excluded.kind,
         title = CASE WHEN practice_sets.title = '' THEN excluded.title ELSE practice_sets.title END,
         job_id = COALESCE(excluded.job_id, practice_sets.job_id),
         updated_at = datetime('now')`
    )
    .run(id, subjectId, kind, title, jobId ?? null);
  return getPracticeSet(id)!;
}

export function getPracticeSet(id: string): PracticeSet | null {
  const row = getDb().prepare("SELECT * FROM practice_sets WHERE id = ?").get(id) as
    | (PracticeSet & { kind: string })
    | undefined;
  if (row) return { ...row, kind: cleanKind(row.kind) };

  const exercise = getDb()
    .prepare("SELECT subject_id, created_at FROM exercises WHERE set_id = ? ORDER BY created_at ASC LIMIT 1")
    .get(id) as { subject_id: string; created_at: string } | undefined;
  const trueFalse = getDb()
    .prepare("SELECT subject_id, created_at FROM truefalse WHERE set_id = ? ORDER BY created_at ASC LIMIT 1")
    .get(id) as { subject_id: string; created_at: string } | undefined;
  const typed = getDb()
    .prepare("SELECT subject_id, created_at FROM typed_exercises WHERE set_id = ? ORDER BY created_at ASC LIMIT 1")
    .get(id) as { subject_id: string; created_at: string } | undefined;

  const first = exercise ?? trueFalse ?? typed;
  if (!first) return null;

  const kinds: Exclude<PracticeSetKind, "mixed">[] = [];
  if (exercise) kinds.push("exercises");
  if (trueFalse) kinds.push("truefalse");
  if (typed) kinds.push("typed");

  return ensurePracticeSet(id, first.subject_id, kinds.length > 1 ? "mixed" : kinds[0], id);
}

export function touchPracticeSet(id: string): void {
  getDb().prepare("UPDATE practice_sets SET last_opened_at = datetime('now') WHERE id = ?").run(id);
}

export function getPracticeSetItems(setId: string): PracticeSetItems {
  return {
    exercises: listExercisesBySet(setId),
    items: listTrueFalseBySet(setId),
    typedExercises: listTypedExercisesBySet(setId),
  };
}
