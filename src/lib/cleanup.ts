import { getDb } from "./db";

export type CleanupType =
  | "quizzes"
  | "mockExams"
  | "exercises"
  | "truefalse"
  | "typed"
  | "flashcards";

export interface CleanupCounts {
  quizzes: number;
  mockExams: number;
  exercises: number;
  truefalse: number;
  typed: number;
  flashcards: number;
}

export function cleanupOldContent(olderThan: string, types: CleanupType[]): CleanupCounts {
  const db = getDb();
  const counts: CleanupCounts = {
    quizzes: 0,
    mockExams: 0,
    exercises: 0,
    truefalse: 0,
    typed: 0,
    flashcards: 0,
  };

  const count = (sql: string) => (db.prepare(sql).get(olderThan) as { n: number }).n;

  const run = db.transaction(() => {
    if (types.includes("quizzes")) {
      counts.quizzes = count(
        "SELECT COUNT(*) n FROM quizzes WHERE duration_min IS NULL AND date(created_at) < date(?)"
      );
      db.prepare(
        "DELETE FROM quizzes WHERE duration_min IS NULL AND date(created_at) < date(?)"
      ).run(olderThan);
    }
    if (types.includes("mockExams")) {
      counts.mockExams = count(
        "SELECT COUNT(*) n FROM quizzes WHERE duration_min IS NOT NULL AND date(created_at) < date(?)"
      );
      db.prepare(
        "DELETE FROM quizzes WHERE duration_min IS NOT NULL AND date(created_at) < date(?)"
      ).run(olderThan);
    }
    if (types.includes("exercises")) {
      counts.exercises = count("SELECT COUNT(*) n FROM exercises WHERE date(created_at) < date(?)");
      db.prepare("DELETE FROM exercises WHERE date(created_at) < date(?)").run(olderThan);
    }
    if (types.includes("truefalse")) {
      counts.truefalse = count("SELECT COUNT(*) n FROM truefalse WHERE date(created_at) < date(?)");
      db.prepare("DELETE FROM truefalse WHERE date(created_at) < date(?)").run(olderThan);
    }
    if (types.includes("typed")) {
      counts.typed = count(
        "SELECT COUNT(*) n FROM typed_exercises WHERE date(created_at) < date(?)"
      );
      db.prepare("DELETE FROM typed_exercises WHERE date(created_at) < date(?)").run(olderThan);
    }
    if (types.includes("flashcards")) {
      counts.flashcards = count("SELECT COUNT(*) n FROM flashcards WHERE date(created_at) < date(?)");
      db.prepare("DELETE FROM flashcards WHERE date(created_at) < date(?)").run(olderThan);
    }
  });

  run();
  return counts;
}
