import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-assignments-"));
process.env.DATA_DIR = dir;

import { getDb } from "@/lib/db";
import {
  applyTemplate,
  createStudent,
  createTemplate,
  listAssignments,
} from "@/lib/assignments";

let studentId: string;

beforeAll(() => {
  getDb().prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-admin", "Math");
  studentId = createStudent("Kid").id;
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("assignments and templates", () => {
  it("applies a template as a dated sequence", () => {
    const template = createTemplate({
      name: "Weekly math routine",
      description: "Lesson then quiz.",
      items: [
        { type: "lesson", title: "Read fractions", subjectId: "subj-admin", dueOffsetDays: 0 },
        { type: "quiz", title: "Fractions quiz", subjectId: "subj-admin", dueOffsetDays: 2 },
      ],
    });

    const assignments = applyTemplate(template.id, studentId);
    expect(assignments).toHaveLength(2);
    expect(assignments[0].due_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(assignments[1].due_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const open = listAssignments({ status: "todo", studentId });
    expect(open.map((a) => a.title)).toEqual(["Read fractions", "Fractions quiz"]);
  });
});
