import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { getMaterial } from "./subjects";

export type BoardCardKind = "task" | "lesson" | "chapter" | "material";

export interface BoardCard {
  id: string;
  subject_id: string;
  column_id: string;
  title: string;
  note: string;
  kind: BoardCardKind;
  lesson_id: string | null;
  chapter_id: string | null;
  material_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface BoardColumn {
  id: string;
  subject_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  cards: BoardCard[];
}

export interface BoardOrderInput {
  id: string;
  cards: { id: string }[];
}

function nextSortOrder(table: "board_columns" | "board_cards", where: string, arg: string): number {
  const row = getDb()
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS n FROM ${table} WHERE ${where} = ?`)
    .get(arg) as { n: number };
  return row.n + 1;
}

export function getBoardColumn(id: string): Omit<BoardColumn, "cards"> | null {
  const row = getDb()
    .prepare("SELECT id, subject_id, name, sort_order, created_at FROM board_columns WHERE id = ?")
    .get(id) as Omit<BoardColumn, "cards"> | undefined;
  return row ?? null;
}

export function getBoardCard(id: string): BoardCard | null {
  const row = getDb().prepare("SELECT * FROM board_cards WHERE id = ?").get(id) as
    | BoardCard
    | undefined;
  return row ?? null;
}

export function listBoard(subjectId: string): BoardColumn[] {
  const db = getDb();
  const columns = db
    .prepare(
      "SELECT id, subject_id, name, sort_order, created_at FROM board_columns WHERE subject_id = ? ORDER BY sort_order ASC, rowid ASC"
    )
    .all(subjectId) as Omit<BoardColumn, "cards">[];
  if (columns.length === 0) return [];

  const cards = db
    .prepare("SELECT * FROM board_cards WHERE subject_id = ? ORDER BY sort_order ASC, rowid ASC")
    .all(subjectId) as BoardCard[];
  const byColumn = new Map<string, BoardCard[]>();
  for (const card of cards) {
    const arr = byColumn.get(card.column_id) ?? [];
    arr.push(card);
    byColumn.set(card.column_id, arr);
  }

  return columns.map((column) => ({ ...column, cards: byColumn.get(column.id) ?? [] }));
}

export function createBoardColumn(subjectId: string, name: string): BoardColumn {
  const id = randomUUID();
  const sortOrder = nextSortOrder("board_columns", "subject_id", subjectId);
  getDb()
    .prepare("INSERT INTO board_columns (id, subject_id, name, sort_order) VALUES (?, ?, ?, ?)")
    .run(id, subjectId, name.trim(), sortOrder);
  return { ...getBoardColumn(id)!, cards: [] };
}

export function resolveBoardColumn(subjectId: string, name: string): BoardColumn {
  const trimmed = name.trim();
  const existing = getDb()
    .prepare(
      "SELECT id, subject_id, name, sort_order, created_at FROM board_columns WHERE subject_id = ? AND lower(name) = lower(?)"
    )
    .get(subjectId, trimmed) as Omit<BoardColumn, "cards"> | undefined;
  if (existing) return { ...existing, cards: [] };
  return createBoardColumn(subjectId, trimmed);
}

export function renameBoardColumn(id: string, name: string): boolean {
  const info = getDb().prepare("UPDATE board_columns SET name = ? WHERE id = ?").run(name.trim(), id);
  return info.changes > 0;
}

export function deleteBoardColumn(id: string): boolean {
  const info = getDb().prepare("DELETE FROM board_columns WHERE id = ?").run(id);
  return info.changes > 0;
}

export function createBoardCard(
  columnId: string,
  title: string,
  kind: BoardCardKind = "task",
  note = ""
): BoardCard | null {
  const column = getBoardColumn(columnId);
  if (!column) return null;
  const id = randomUUID();
  const sortOrder = nextSortOrder("board_cards", "column_id", columnId);
  getDb()
    .prepare(
      "INSERT INTO board_cards (id, subject_id, column_id, title, note, kind, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(id, column.subject_id, columnId, title.trim(), note.trim(), kind, sortOrder);
  return getBoardCard(id);
}

export function deleteBoardCard(id: string): boolean {
  const info = getDb().prepare("DELETE FROM board_cards WHERE id = ?").run(id);
  return info.changes > 0;
}

export function listMaterialIdsInColumns(columnIds: string[]): string[] {
  if (columnIds.length === 0) return [];
  const placeholders = columnIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT material_id FROM board_cards WHERE column_id IN (${placeholders}) AND material_id IS NOT NULL`
    )
    .all(...columnIds) as { material_id: string }[];
  return rows.map((row) => row.material_id);
}

export function getBoardCardByMaterial(materialId: string): BoardCard | null {
  const row = getDb().prepare("SELECT * FROM board_cards WHERE material_id = ?").get(materialId) as
    | BoardCard
    | undefined;
  return row ?? null;
}

export function assignMaterialToColumn(materialId: string, columnId: string): BoardCard | null {
  const column = getBoardColumn(columnId);
  const material = getMaterial(materialId);
  if (!column || !material || material.subject_id !== column.subject_id) return null;

  const existing = getBoardCardByMaterial(materialId);
  if (existing) {
    const sortOrder = nextSortOrder("board_cards", "column_id", columnId);
    getDb()
      .prepare("UPDATE board_cards SET column_id = ?, sort_order = ?, title = ? WHERE id = ?")
      .run(columnId, sortOrder, material.filename, existing.id);
    return getBoardCard(existing.id);
  }

  const id = randomUUID();
  const sortOrder = nextSortOrder("board_cards", "column_id", columnId);
  getDb()
    .prepare(
      `INSERT INTO board_cards
        (id, subject_id, column_id, title, kind, material_id, sort_order)
       VALUES (?, ?, ?, ?, 'material', ?, ?)`
    )
    .run(id, column.subject_id, columnId, material.filename, materialId, sortOrder);
  return getBoardCard(id);
}

export function saveBoardOrder(subjectId: string, columns: BoardOrderInput[]): boolean {
  const db = getDb();
  const updateColumn = db.prepare(
    "UPDATE board_columns SET sort_order = ? WHERE id = ? AND subject_id = ?"
  );
  const updateCard = db.prepare(
    "UPDATE board_cards SET column_id = ?, sort_order = ? WHERE id = ? AND subject_id = ?"
  );

  const run = db.transaction((input: BoardOrderInput[]) => {
    for (const [columnIndex, column] of input.entries()) {
      const columnInfo = updateColumn.run(columnIndex, column.id, subjectId);
      if (columnInfo.changes !== 1) throw new Error("column_not_found");
      for (const [cardIndex, card] of column.cards.entries()) {
        const cardInfo = updateCard.run(column.id, cardIndex, card.id, subjectId);
        if (cardInfo.changes !== 1) throw new Error("card_not_found");
      }
    }
  });

  run(columns);
  return true;
}