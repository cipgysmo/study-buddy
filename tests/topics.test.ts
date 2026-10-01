import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-topics-"));
process.env.DATA_DIR = dir;

import { getDb } from "@/lib/db";
import {
  createTopic,
  deleteTopic,
  getTopic,
  listTopics,
  materialTopicNames,
  resolveTopicIds,
  setMaterialTopics,
  topicNames,
} from "@/lib/topics";

let subjectId: string;

beforeAll(() => {
  const db = getDb();
  const info = db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-1", "Math");
  subjectId = "subj-1";
  expect(info.changes).toBe(1);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("topics", () => {
  it("creates and lists topics for a subject", () => {
    const a = createTopic(subjectId, "Pythagoras");
    const b = createTopic(subjectId, "Triangles");
    expect(a.name).toBe("Pythagoras");
    expect(b.name).toBe("Triangles");
    const topics = listTopics(subjectId);
    expect(topics.map((t) => t.name)).toEqual(["Pythagoras", "Triangles"]);
    expect(topics.every((t) => t.subject_id === subjectId)).toBe(true);
  });

  it("trims topic names", () => {
    const t = createTopic(subjectId, "  Circles  ");
    expect(t.name).toBe("Circles");
  });

  it("resolves ids to names, skipping unknown ids", () => {
    const topics = listTopics(subjectId);
    const names = topicNames([topics[0].id, "nope", topics[1].id]);
    expect(names).toEqual(["Pythagoras", "Triangles"]);
    expect(topicNames([])).toEqual([]);
  });

  it("fetches a single topic or null", () => {
    const t = listTopics(subjectId)[0];
    expect(getTopic(t.id)?.name).toBe(t.name);
    expect(getTopic("missing")).toBeNull();
  });

  it("deletes a topic", () => {
    const t = createTopic(subjectId, "Temp");
    expect(getTopic(t.id)).not.toBeNull();
    deleteTopic(t.id);
    expect(getTopic(t.id)).toBeNull();
    expect(listTopics(subjectId).map((x) => x.name)).not.toContain("Temp");
  });

  it("tags a material with topics and lists them by name", () => {
    const db = getDb();
    const topics = listTopics(subjectId);
    const matId = "mat-1";
    db.prepare(
      "INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(matId, subjectId, "a.txt", "/tmp/a.txt", "text/plain", "text", 10);
    setMaterialTopics(matId, [topics[0].id, topics[1].id]);
    expect(materialTopicNames([matId]).get(matId)).toEqual([
      topics[0].name,
      topics[1].name,
    ]);
    // re-tagging replaces the previous set
    setMaterialTopics(matId, [topics[0].id]);
    expect(materialTopicNames([matId]).get(matId)).toEqual([topics[0].name]);
    expect(materialTopicNames(["missing"])).toEqual(new Map());
  });

  it("cascades topic deletion when the subject is removed", () => {
    const db = getDb();
    db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-2", "Physics");
    const t = createTopic("subj-2", "Mechanics");
    db.prepare("DELETE FROM subjects WHERE id = ?").run("subj-2");
    expect(getTopic(t.id)).toBeNull();
  });

  it("resolveTopicIds reuses matches, creates new ones, dedupes, skips empty", () => {
    const db = getDb();
    db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-resolve", "Chem");
    const sid = "subj-resolve";
    const existing = createTopic(sid, "Stoichiometry");
    const ids = resolveTopicIds(sid, ["Stoichiometry", "  Stoichiometry  ", "Moles", ""]);
    expect(ids.length).toBe(2);
    expect(ids[0]).toBe(existing.id);
    expect(listTopics(sid).map((t) => t.name)).toEqual(["Stoichiometry", "Moles"]);
  });

  it("resolveTopicIds creates all topics when the subject has none", () => {
    const db = getDb();
    db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-resolve2", "Bio");
    const sid = "subj-resolve2";
    const ids = resolveTopicIds(sid, ["Cells", "DNA"]);
    expect(ids.length).toBe(2);
    expect(listTopics(sid).map((t) => t.name)).toEqual(["Cells", "DNA"]);
  });
});
