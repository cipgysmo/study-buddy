import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-lessons-"));
process.env.DATA_DIR = dir;

const { state } = vi.hoisted(() => ({ state: { callIndex: 0 } }));

vi.mock("@/lib/llm", () => ({
  chatJSON: vi.fn(async () => {
    const i = state.callIndex++;
    if (i === 0) {
      return {
        title: "Fractions 101",
        chapters: [
          { title: "What is a fraction", summary: "Parts of a whole." },
          { title: "Equivalent fractions", summary: "Different forms, same value." },
        ],
      };
    }
    return {
      explanation: "A fraction is part of a whole, e.g. $\\frac{1}{2}$.",
      diagram:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><circle r="5"/></svg>',
      check: {
        question: "Which is a fraction?",
        options: ["1/2", "cat", "run"],
        answerIndex: 0,
        explanation: "It has a numerator and denominator.",
      },
      figureIndexes: [0],
    };
  }),
}));

import { getDb } from "@/lib/db";
import {
  countChapters,
  createLesson,
  generateLesson,
  getLesson,
  listChapters,
  listLessons,
} from "@/lib/lessons";

let subjectId: string;

beforeAll(() => {
  const db = getDb();
  db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-1", "Math");
  subjectId = "subj-1";
  db.prepare(
    "INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size, extracted_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run("mat-1", subjectId, "notes.txt", "/tmp/mat-1", "text/plain", "text", 20, "Fractions are parts of a whole.");
  db.prepare(
    "INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size, status, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run("img-1", subjectId, "fraction-diagram.png", "/tmp/img-1", "image/png", "image", 10, "ready", "notes");
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  state.callIndex = 0;
});

describe("lessons", () => {
  it("creates a lesson shell in processing state", () => {
    const l = createLesson(subjectId, ["t1", "t2"]);
    expect(l.status).toBe("processing");
    expect(l.topic_ids).toEqual(["t1", "t2"]);
    expect(listLessons(subjectId).map((x) => x.id)).toContain(l.id);
  });

  it("builds chapters via a two-pass generation and marks ready", async () => {
    const l = createLesson(subjectId, []);
    const count = await generateLesson(l.id);
    expect(count).toBe(2);

    const saved = getLesson(l.id)!;
    expect(saved.status).toBe("ready");
    expect(saved.title).toBe("Fractions 101");

    const chapters = listChapters(l.id);
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("What is a fraction");
    expect(chapters[0].body).toContain("fraction");
    expect(chapters[0].diagram).toContain("<svg");
    expect(chapters[0].check?.answerIndex).toBe(0);
    expect(chapters[0].figure_ids).toEqual(["img-1"]);
    expect(chapters[0].sort_order).toBe(0);
    expect(chapters[1].sort_order).toBe(1);
    expect(countChapters(l.id)).toBe(2);
  });

  it("is idempotent: rebuilding replaces chapters, no duplicates", async () => {
    const l = createLesson(subjectId, []);
    await generateLesson(l.id);
    state.callIndex = 0;
    await generateLesson(l.id);
    expect(countChapters(l.id)).toBe(2);
  });

  it("fails when the subject has no material text", async () => {
    getDb().prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-empty", "Empty");
    const l = createLesson("subj-empty", []);
    await expect(generateLesson(l.id)).rejects.toThrow("no_material");
    expect(getLesson(l.id)!.status).toBe("failed");
  });
});
