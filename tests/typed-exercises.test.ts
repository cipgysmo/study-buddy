import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-typed-"));
process.env.DATA_DIR = dir;

import { getDb } from "@/lib/db";
import { gradeTypedExercise, normalizeAnswer } from "@/lib/typed-exercises";

beforeAll(() => {
  const db = getDb();
  db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-typed", "Math");
  db.prepare(
    `INSERT INTO typed_exercises
      (id, subject_id, prompt, expected_answer, accepted_answers, grading_mode, explanation)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "exact-1",
    "subj-typed",
    "What is 2 + 2?",
    "4",
    JSON.stringify(["4", "four"]),
    "exact",
    "Basic addition."
  );
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("typed exercises", () => {
  it("normalizes answers for exact grading", () => {
    expect(normalizeAnswer("  Four!  ")).toBe("four");
  });

  it("grades exact answers against accepted variants", async () => {
    const correct = await gradeTypedExercise("exact-1", "Four");
    expect(correct).toEqual({ correct: true, score: 100, feedback: "Correct." });

    const incorrect = await gradeTypedExercise("exact-1", "5");
    expect(incorrect.correct).toBe(false);
    expect(incorrect.score).toBe(0);
    expect(incorrect.feedback).toBe("Basic addition.");
  });

  it("rejects empty answers", async () => {
    const result = await gradeTypedExercise("exact-1", "   ");
    expect(result).toEqual({ correct: false, score: 0, feedback: "Enter an answer." });
  });
});
