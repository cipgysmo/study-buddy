import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-cleanup-"));
process.env.DATA_DIR = dir;

import { getDb } from "@/lib/db";
import { cleanupOldContent } from "@/lib/cleanup";

beforeAll(() => {
  const db = getDb();
  db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-cleanup", "Math");

  db.prepare("INSERT INTO quizzes (id, subject_id, title, created_at, duration_min) VALUES (?, ?, ?, ?, ?)").run(
    "old-quiz",
    "subj-cleanup",
    "Old quiz",
    "2025-01-01 10:00:00",
    null
  );
  db.prepare("INSERT INTO quizzes (id, subject_id, title, created_at, duration_min) VALUES (?, ?, ?, ?, ?)").run(
    "old-exam",
    "subj-cleanup",
    "Old exam",
    "2025-01-01 10:00:00",
    30
  );
  db.prepare("INSERT INTO quizzes (id, subject_id, title, created_at, duration_min) VALUES (?, ?, ?, ?, ?)").run(
    "new-quiz",
    "subj-cleanup",
    "New quiz",
    "2026-01-01 10:00:00",
    null
  );
  db.prepare("INSERT INTO exercises (id, subject_id, prompt, solution_steps, created_at) VALUES (?, ?, ?, ?, ?)").run(
    "old-exercise",
    "subj-cleanup",
    "Old exercise",
    "[]",
    "2025-01-01 10:00:00"
  );
  db.prepare("INSERT INTO truefalse (id, subject_id, statement, is_correct, created_at) VALUES (?, ?, ?, ?, ?)").run(
    "old-tf",
    "subj-cleanup",
    "Old statement",
    1,
    "2025-01-01 10:00:00"
  );
  db.prepare(
    "INSERT INTO typed_exercises (id, subject_id, prompt, expected_answer, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run("old-typed", "subj-cleanup", "Old typed", "answer", "2025-01-01 10:00:00");
  db.prepare("INSERT INTO flashcards (id, subject_id, front, back, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    "old-card",
    "subj-cleanup",
    "Old front",
    "Old back",
    "2025-01-01",
    "2025-01-01 10:00:00"
  );
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("cleanupOldContent", () => {
  it("deletes only old selected content", () => {
    const counts = cleanupOldContent("2026-01-01", [
      "quizzes",
      "mockExams",
      "exercises",
      "truefalse",
      "typed",
      "flashcards",
    ]);

    expect(counts).toEqual({
      quizzes: 1,
      mockExams: 1,
      exercises: 1,
      truefalse: 1,
      typed: 1,
      flashcards: 1,
    });

    const db = getDb();
    expect(db.prepare("SELECT id FROM quizzes WHERE id = ?").get("new-quiz")).toBeTruthy();
    expect(db.prepare("SELECT id FROM quizzes WHERE id = ?").get("old-quiz")).toBeFalsy();
    expect(db.prepare("SELECT id FROM quizzes WHERE id = ?").get("old-exam")).toBeFalsy();
  });
});
