import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import { dataDir } from "./env";
import { extractText, kindFromMime, type MaterialKind } from "./extract";
import { ocrImage } from "./ocr";

export interface Subject {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  created_at: string;
  materialCount: number;
}

export interface Material {
  id: string;
  subject_id: string;
  filename: string;
  stored_path: string;
  mime: string;
  kind: MaterialKind;
  size: number;
  extracted_text: string | null;
  created_at: string;
}

const SUBJECT_SELECT = `
  SELECT s.*, (SELECT COUNT(*) FROM materials m WHERE m.subject_id = s.id) AS materialCount
  FROM subjects s
`;

export function listSubjects(): Subject[] {
  return getDb()
    .prepare(`${SUBJECT_SELECT} ORDER BY s.created_at DESC`)
    .all() as Subject[];
}

export function getSubject(id: string): Subject | null {
  const row = getDb()
    .prepare(`${SUBJECT_SELECT} WHERE s.id = ?`)
    .get(id) as Subject | undefined;
  return row ?? null;
}

export function createSubject(name: string, color?: string, icon?: string): Subject {
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO subjects (id, name, color, icon) VALUES (?, ?, ?, ?)")
    .run(id, name.trim(), color?.trim() || "#0071e3", icon?.trim() || null);
  return getSubject(id)!;
}

export function deleteSubject(id: string): void {
  const materials = getDb()
    .prepare("SELECT stored_path FROM materials WHERE subject_id = ?")
    .all(id) as { stored_path: string }[];
  for (const m of materials) {
    try {
      fs.rmSync(m.stored_path, { force: true });
    } catch {
      /* ignore */
    }
  }
  getDb().prepare("DELETE FROM subjects WHERE id = ?").run(id);
}

export function listMaterials(subjectId: string): Material[] {
  return getDb()
    .prepare("SELECT * FROM materials WHERE subject_id = ? ORDER BY created_at DESC")
    .all(subjectId) as Material[];
}

export function getMaterial(id: string): Material | null {
  const row = getDb()
    .prepare("SELECT * FROM materials WHERE id = ?")
    .get(id) as Material | undefined;
  return row ?? null;
}

export async function addMaterial(
  subjectId: string,
  file: { filename: string; mime: string; buffer: Buffer },
  precomputedText?: string | null
): Promise<Material> {
  const id = randomUUID();
  const kind = kindFromMime(file.mime, file.filename);
  const ext = path.extname(file.filename) || (kind === "pdf" ? ".pdf" : "");
  const dir = path.join(dataDir(), "uploads", subjectId);
  fs.mkdirSync(dir, { recursive: true });
  const storedPath = path.join(dir, `${id}${ext}`);
  fs.writeFileSync(storedPath, file.buffer);

  let extractedText: string | null;
  if (precomputedText !== undefined) {
    extractedText = precomputedText;
  } else {
    extractedText = await extractText(file.buffer, kind);
    if (kind === "image" && !extractedText) {
      try {
        extractedText = await ocrImage(file.buffer, file.mime);
      } catch {
        extractedText = null;
      }
    }
  }

  getDb()
    .prepare(
      `INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size, extracted_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, subjectId, file.filename, storedPath, file.mime, kind, file.buffer.length, extractedText);

  return getMaterial(id)!;
}

export function deleteMaterial(id: string): void {
  const m = getMaterial(id);
  if (!m) return;
  try {
    fs.rmSync(m.stored_path, { force: true });
  } catch {
    /* ignore */
  }
  getDb().prepare("DELETE FROM materials WHERE id = ?").run(id);
}
