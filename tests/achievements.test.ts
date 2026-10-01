import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-ach-"));
process.env.DATA_DIR = dir;

import { getDb } from "@/lib/db";
import { getAchievements, syncAchievements } from "@/lib/achievements";

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("achievements", () => {
  it("starts with nothing unlocked", () => {
    expect(syncAchievements()).toEqual([]);
    const all = getAchievements();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((a) => !a.unlocked)).toBe(true);
  });

  it("unlocks the matching achievements and records the time", () => {
    const db = getDb();
    db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("s1", "Math");
    db.prepare(
      "INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("m1", "s1", "a.txt", "/tmp/a.txt", "text/plain", "text", 5);
    db.prepare("INSERT INTO quizzes (id, subject_id, title) VALUES (?, ?, ?)").run("q1", "s1", "Quiz");
    db.prepare(
      "INSERT INTO quiz_attempts (id, quiz_id, score, total, answers) VALUES (?, ?, ?, ?, ?)"
    ).run("a1", "q1", 5, 5, "{}");

    const newly = syncAchievements();
    expect(newly).toContain("firstSubject");
    expect(newly).toContain("firstMaterial");
    expect(newly).toContain("firstQuiz");
    expect(newly).toContain("perfectScore");

    const byId = new Map(getAchievements().map((a) => [a.id, a]));
    expect(byId.get("perfectScore")?.unlocked).toBe(true);
    expect(byId.get("perfectScore")?.unlocked_at).not.toBeNull();
    // library needs 10 materials; with 1 it stays locked and shows progress
    expect(byId.get("library")?.unlocked).toBe(false);
    expect(byId.get("library")?.current).toBe(1);
    expect(byId.get("library")?.target).toBe(10);
  });

  it("is idempotent (does not re-unlock)", () => {
    expect(syncAchievements()).toEqual([]);
  });
});
