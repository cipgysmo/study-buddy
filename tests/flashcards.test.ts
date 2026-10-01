import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-fsrs-"));
process.env.DATA_DIR = dir;

import { getDb } from "@/lib/db";
import { reviewFlashcard } from "@/lib/flashcards";
import { getProgress } from "@/lib/progress";

let subjectId: string;

function insertCard(id: string): void {
  getDb()
    .prepare(
      "INSERT INTO flashcards (id, subject_id, front, back, ease, interval, reps, due_at, stability, difficulty, state, lapses, last_review) VALUES (?, ?, ?, ?, 2.5, 0, 0, ?, 0, 0, 0, 0, NULL)"
    )
    .run(id, subjectId, "Q", "A", new Date().toISOString().slice(0, 10));
}

function logCount(cardId: string): number {
  return (
    (getDb().prepare("SELECT COUNT(*) n FROM review_logs WHERE card_id = ?").get(cardId) as { n: number })
      ?.n ?? 0
  );
}

beforeAll(() => {
  getDb().prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-fsrs", "Math");
  subjectId = "subj-fsrs";
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("fsrs review", () => {
  it("new card + Easy graduates to Review with positive stability", () => {
    insertCard("c1");
    const c = reviewFlashcard("c1", 4)!;
    expect(c.state).toBe(2); // Review
    expect(c.stability).toBeGreaterThan(0);
    expect(c.last_review).not.toBeNull();
    expect(logCount("c1")).toBe(1);
  });

  it("new card + Good enters Learning", () => {
    insertCard("c2");
    const c = reviewFlashcard("c2", 3)!;
    expect(c.state).toBe(1); // Learning
    expect(c.stability).toBeGreaterThan(0);
  });

  it("Again on a graduated card lapses into Relearning", () => {
    insertCard("c3");
    reviewFlashcard("c3", 4); // graduate
    const c = reviewFlashcard("c3", 1)!;
    expect(c.state).toBe(3); // Relearning
    expect(c.lapses).toBeGreaterThanOrEqual(1);
  });

  it("Easy yields more stability than Good on a new card", () => {
    insertCard("c4a");
    insertCard("c4b");
    const easy = reviewFlashcard("c4a", 4)!;
    const good = reviewFlashcard("c4b", 3)!;
    expect(easy.stability).toBeGreaterThan(good.stability);
  });

  it("records one review log per review", () => {
    insertCard("c5");
    reviewFlashcard("c5", 3);
    reviewFlashcard("c5", 3);
    expect(logCount("c5")).toBe(2);
  });

  it("ignores out-of-range ratings", () => {
    insertCard("c6");
    const c = reviewFlashcard("c6", 99)!;
    expect(c.state).toBe(0); // unchanged (New)
    expect(logCount("c6")).toBe(0);
  });

  it("getProgress exposes retention stats and a 16-week heatmap", () => {
    const p = getProgress();
    expect(p.retention.heatmap.length).toBe(112);
    expect(p.retention.totalReviews).toBeGreaterThanOrEqual(5);
    expect(typeof p.retention.dueToday).toBe("number");
    if (p.retention.predicted !== null) {
      expect(p.retention.predicted).toBeGreaterThanOrEqual(0);
      expect(p.retention.predicted).toBeLessThanOrEqual(1);
    }
  });
});
