import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-board-"));
process.env.DATA_DIR = dir;

import { getDb } from "@/lib/db";
import {
  createBoardCard,
  createBoardColumn,
  deleteBoardCard,
  deleteBoardColumn,
  listBoard,
  renameBoardColumn,
  saveBoardOrder,
} from "@/lib/board";

let subjectId: string;

beforeAll(() => {
  const db = getDb();
  db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-board", "Math");
  subjectId = "subj-board";
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("subject board", () => {
  it("creates columns and cards in order", () => {
    const todo = createBoardColumn(subjectId, "Todo");
    const doing = createBoardColumn(subjectId, "Doing");
    const a = createBoardCard(todo.id, "Read chapter", "lesson");
    const b = createBoardCard(todo.id, "Make notes", "task");

    expect(todo.sort_order).toBe(0);
    expect(doing.sort_order).toBe(1);
    expect(a?.kind).toBe("lesson");
    expect(b?.sort_order).toBe(1);

    const board = listBoard(subjectId);
    expect(board.map((c) => c.name)).toEqual(["Todo", "Doing"]);
    expect(board[0].cards.map((c) => c.title)).toEqual(["Read chapter", "Make notes"]);
    expect(board[1].cards).toEqual([]);
  });

  it("renames columns and deletes cards", () => {
    const board = listBoard(subjectId);
    const column = board[0];
    expect(renameBoardColumn(column.id, "To study")).toBe(true);
    expect(listBoard(subjectId)[0].name).toBe("To study");

    const card = column.cards[0];
    expect(deleteBoardCard(card.id)).toBe(true);
    expect(listBoard(subjectId)[0].cards.map((c) => c.title)).toEqual(["Make notes"]);
  });

  it("saves drag-and-drop order across columns", () => {
    const board = listBoard(subjectId);
    const first = board[0];
    const second = board[1];
    const moved = createBoardCard(first.id, "Move me", "chapter")!;
    const kept = createBoardCard(second.id, "Stay", "task")!;

    saveBoardOrder(subjectId, [
      { id: second.id, cards: [{ id: kept.id }, { id: moved.id }] },
      { id: first.id, cards: [] },
    ]);

    const saved = listBoard(subjectId);
    expect(saved.map((c) => c.name)).toEqual(["Doing", "To study"]);
    expect(saved[0].cards.map((c) => c.title)).toEqual(["Stay", "Move me"]);
    expect(saved[0].cards[1].column_id).toBe(second.id);
    expect(saved[0].cards[1].sort_order).toBe(1);
  });

  it("cascades board rows when the subject is removed", () => {
    const db = getDb();
    db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-board-2", "Bio");
    const column = createBoardColumn("subj-board-2", "Notes");
    createBoardCard(column.id, "Cells");
    db.prepare("DELETE FROM subjects WHERE id = ?").run("subj-board-2");
    expect(listBoard("subj-board-2")).toEqual([]);
    expect(deleteBoardColumn(column.id)).toBe(false);
  });
});