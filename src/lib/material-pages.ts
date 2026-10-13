import { randomUUID } from "node:crypto";
import { getDb } from "./db";

export interface MaterialPage {
  id: string;
  material_id: string;
  page_number: number;
  image_path: string | null;
  text: string | null;
  topic_id: string | null;
  status: "pending" | "ready" | "failed";
  error: string | null;
  created_at: string;
}

export interface MaterialPageSummary {
  page_number: number;
  status: MaterialPage["status"];
  has_image: boolean;
  text_length: number;
  error: string | null;
}

export function setMaterialPageCount(materialId: string, pageCount: number): void {
  getDb().prepare("UPDATE materials SET page_count = ? WHERE id = ?").run(pageCount, materialId);
}

export function upsertMaterialPage(
  materialId: string,
  pageNumber: number,
  page: {
    imagePath?: string | null;
    text?: string | null;
    status: MaterialPage["status"];
    error?: string | null;
  }
): void {
  const existing = getDb()
    .prepare("SELECT id, image_path FROM material_pages WHERE material_id = ? AND page_number = ?")
    .get(materialId, pageNumber) as { id: string; image_path: string | null } | undefined;

  if (existing) {
    getDb()
      .prepare(
        `UPDATE material_pages
         SET image_path = COALESCE(?, image_path), text = ?, status = ?, error = ?
         WHERE id = ?`
      )
      .run(page.imagePath ?? null, page.text ?? null, page.status, page.error ?? null, existing.id);
    return;
  }

  getDb()
    .prepare(
      `INSERT INTO material_pages (id, material_id, page_number, image_path, text, status, error)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      materialId,
      pageNumber,
      page.imagePath ?? null,
      page.text ?? null,
      page.status,
      page.error ?? null
    );
}

export function listMaterialPageSummaries(materialId: string): MaterialPageSummary[] {
  const rows = getDb()
    .prepare(
      `SELECT page_number, status, image_path, text, error
       FROM material_pages
       WHERE material_id = ?
       ORDER BY page_number ASC`
    )
    .all(materialId) as {
    page_number: number;
    status: MaterialPage["status"];
    image_path: string | null;
    text: string | null;
    error: string | null;
  }[];

  return rows.map((row) => ({
    page_number: row.page_number,
    status: row.status,
    has_image: Boolean(row.image_path),
    text_length: row.text?.length ?? 0,
    error: row.error,
  }));
}

export function tagMaterialPages(materialId: string, startPage: number, endPage: number, topicId: string): void {
  getDb()
    .prepare(
      `UPDATE material_pages
       SET topic_id = ?
       WHERE material_id = ? AND page_number BETWEEN ? AND ?`
    )
    .run(topicId, materialId, startPage, endPage);
}

export function listMaterialPageTextsInRange(materialId: string, startPage: number, endPage: number): { page_number: number; text: string }[] {
  const rows = getDb()
    .prepare(
      `SELECT page_number, text
       FROM material_pages
       WHERE material_id = ? AND page_number BETWEEN ? AND ? AND text IS NOT NULL
       ORDER BY page_number ASC`
    )
    .all(materialId, startPage, endPage) as { page_number: number; text: string }[];
  return rows;
}

export function getMaterialPage(materialId: string, pageNumber: number): MaterialPage | null {
  const row = getDb()
    .prepare("SELECT * FROM material_pages WHERE material_id = ? AND page_number = ?")
    .get(materialId, pageNumber) as MaterialPage | undefined;
  return row ?? null;
}
