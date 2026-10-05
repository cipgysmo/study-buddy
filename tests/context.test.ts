import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-context-"));
process.env.DATA_DIR = dir;

import { getDb } from "@/lib/db";
import { buildSubjectContext } from "@/lib/context";
import { createTopic, setMaterialTopics } from "@/lib/topics";

let subjectId: string;

function addMaterial(id: string, filename: string, text: string) {
  getDb()
    .prepare(
      "INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size, extracted_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(id, subjectId, filename, `/tmp/${id}`, "text/plain", "text", text.length, text);
}

beforeAll(() => {
  getDb().prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-1", "Math");
  subjectId = "subj-1";
  addMaterial("mat-a", "a.txt", "ALPHA content");
  addMaterial("mat-b", "b.txt", "BETA content");
  addMaterial("mat-c", "c.txt", "GAMMA content");
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("buildSubjectContext", () => {
  it("includes all materials when no topics are given", () => {
    const ctx = buildSubjectContext(subjectId);
    expect(ctx).toContain("ALPHA");
    expect(ctx).toContain("BETA");
    expect(ctx).toContain("GAMMA");
  });

  it("includes only materials tagged with the selected topics", () => {
    const triangles = createTopic(subjectId, "Triangles");
    const circles = createTopic(subjectId, "Circles");
    setMaterialTopics("mat-a", [triangles.id]);
    setMaterialTopics("mat-b", [circles.id]);
    // mat-c stays untagged

    const onlyTriangles = buildSubjectContext(subjectId, [triangles.id]);
    expect(onlyTriangles).toContain("ALPHA");
    expect(onlyTriangles).not.toContain("BETA");
    expect(onlyTriangles).not.toContain("GAMMA");

    const both = buildSubjectContext(subjectId, [triangles.id, circles.id]);
    expect(both).toContain("ALPHA");
    expect(both).toContain("BETA");
    expect(both).not.toContain("GAMMA");
  });

  it("falls back to all materials when the selected topics have no tagged materials", () => {
    const squares = createTopic(subjectId, "Squares");
    const ctx = buildSubjectContext(subjectId, [squares.id]);
    expect(ctx).toContain("ALPHA");
    expect(ctx).toContain("BETA");
    expect(ctx).toContain("GAMMA");
  });

  it("filters materials by board container", () => {
    getDb()
      .prepare("INSERT INTO board_columns (id, subject_id, name, sort_order) VALUES (?, ?, ?, ?)")
      .run("col-1", subjectId, "Photos", 0);
    getDb()
      .prepare(
        `INSERT INTO board_cards
          (id, subject_id, column_id, title, kind, material_id, sort_order)
         VALUES (?, ?, ?, ?, 'material', ?, ?)`
      )
      .run("card-1", subjectId, "col-1", "a.txt", "mat-a", 0);

    const ctx = buildSubjectContext(subjectId, undefined, 60000, { columnIds: ["col-1"] });
    expect(ctx).toContain("ALPHA");
    expect(ctx).not.toContain("BETA");
    expect(ctx).not.toContain("GAMMA");
  });

  it("filters materials by keywords", () => {
    const ctx = buildSubjectContext(subjectId, undefined, 60000, { keywords: ["BETA"] });
    expect(ctx).toContain("BETA");
    expect(ctx).not.toContain("ALPHA");
    expect(ctx).not.toContain("GAMMA");
  });
});
