import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-board-"));
process.env.DATA_DIR = dir;

import { getDb } from "@/lib/db";
import {
  assignMaterialToColumn,
  createBoardCard,
  createBoardColumn,
  deleteBoardCard,
  deleteBoardColumn,
  getBoardCardByMaterial,
  listBoard,
  moveBoardColumnToSubject,
  renameBoardColumn,
  resolveBoardColumn,
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

  it("assigns an uploaded material to a container and moves the same card", () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size, status, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("mat-board", subjectId, "photo.png", "/tmp/photo.png", "image/png", "image", 10, "ready", "notes");

    const board = listBoard(subjectId);
    const first = createBoardColumn(subjectId, "Photos");
    const second = createBoardColumn(subjectId, "Archive");

    const card = assignMaterialToColumn("mat-board", first.id);
    expect(card?.kind).toBe("material");
    expect(card?.material_id).toBe("mat-board");
    expect(getBoardCardByMaterial("mat-board")?.column_id).toBe(first.id);

    const moved = assignMaterialToColumn("mat-board", second.id);
    expect(moved?.column_id).toBe(second.id);
    expect(listBoard(subjectId).flatMap((c) => c.cards.filter((c2) => c2.material_id === "mat-board"))).toHaveLength(1);
    expect(board).toBeDefined();
  });

  it("resolves a container by name, creating it only when missing", () => {
    const created = resolveBoardColumn(subjectId, "Uploads");
    const reused = resolveBoardColumn(subjectId, "uploads");
    expect(created.id).toBe(reused.id);
    expect(listBoard(subjectId).filter((c) => c.name === "Uploads")).toHaveLength(1);
  });

  it("moves a container and its materials to another subject", () => {
    const db = getDb();
    db.prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-board-3", "Physics");
    db.prepare(
      "INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size, status, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("mat-move", subjectId, "notes.pdf", "/tmp/notes.pdf", "application/pdf", "text", 10, "ready", "notes");

    const column = createBoardColumn(subjectId, "Move me");
    assignMaterialToColumn("mat-move", column.id);

    expect(moveBoardColumnToSubject(column.id, "subj-board-3")).toBe(true);
    expect(listBoard(subjectId).some((c) => c.id === column.id)).toBe(false);
    expect(listBoard("subj-board-3").some((c) => c.id === column.id)).toBe(true);
    expect((db.prepare("SELECT subject_id FROM materials WHERE id = ?").get("mat-move") as { subject_id: string }).subject_id).toBe("subj-board-3");
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