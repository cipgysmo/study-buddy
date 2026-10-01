import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import { dataDir } from "./env";
import { extractText, kindFromMime, type MaterialKind } from "./extract";
import { ocrImage } from "./ocr";
import { removeDerivedDir, removeDerivedImages } from "./image-derive";

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
  status: "processing" | "ready" | "failed";
  error: string | null;
  job_id: string | null;
  /** "notes" = study content; "exam" = a school exam paper used as a template. */
  role: "notes" | "exam";
  /** Job that parses an exam paper into questions (role = "exam" only). */
  parse_job_id: string | null;
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
  removeDerivedDir(id);
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

function storeFile(
  subjectId: string,
  id: string,
  file: { filename: string; mime: string; buffer: Buffer }
): { storedPath: string; kind: MaterialKind } {
  const kind = kindFromMime(file.mime, file.filename);
  const ext = path.extname(file.filename) || (kind === "pdf" ? ".pdf" : "");
  const dir = path.join(dataDir(), "uploads", subjectId);
  fs.mkdirSync(dir, { recursive: true });
  const storedPath = path.join(dir, `${id}${ext}`);
  fs.writeFileSync(storedPath, file.buffer);
  return { storedPath, kind };
}

/** Save the file and insert a row that a background "ocr" job will process. */
export function addMaterialPending(
  subjectId: string,
  file: { filename: string; mime: string; buffer: Buffer },
  role: "notes" | "exam" = "notes"
): Material {
  const id = randomUUID();
  const { storedPath, kind } = storeFile(subjectId, id, file);
  getDb()
    .prepare(
      `INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing')`
    )
    .run(id, subjectId, file.filename, storedPath, file.mime, kind, file.buffer.length, role);
  return getMaterial(id)!;
}

export function linkMaterialParseJob(materialId: string, jobId: string): void {
  getDb().prepare("UPDATE materials SET parse_job_id = ? WHERE id = ?").run(jobId, materialId);
}

/** Save the file with already-extracted text (scan flow). */
export function addMaterialWithText(
  subjectId: string,
  file: { filename: string; mime: string; buffer: Buffer },
  text: string,
  jobId?: string
): Material {
  const id = randomUUID();
  const { storedPath, kind } = storeFile(subjectId, id, file);
  getDb()
    .prepare(
      `INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size, extracted_text, status, job_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?)`
    )
    .run(id, subjectId, file.filename, storedPath, file.mime, kind, file.buffer.length, text, jobId ?? null);
  return getMaterial(id)!;
}

export function linkMaterialJob(materialId: string, jobId: string): void {
  getDb().prepare("UPDATE materials SET job_id = ? WHERE id = ?").run(jobId, materialId);
}

/** Background job: extract text (OCR for images) and mark the material ready/failed. */
export async function processMaterial(materialId: string): Promise<void> {
  const db = getDb();
  const m = getMaterial(materialId);
  if (!m) return;
  db.prepare("UPDATE materials SET status = 'processing', error = NULL WHERE id = ?").run(materialId);
  try {
    const buffer = fs.readFileSync(m.stored_path);
    let text = await extractText(buffer, m.kind);
    if (m.kind === "image" && !text) {
      text = await ocrImage(buffer, m.mime);
    }
    db.prepare(
      "UPDATE materials SET extracted_text = ?, status = 'ready', error = NULL WHERE id = ?"
    ).run(text, materialId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    db.prepare("UPDATE materials SET status = 'failed', error = ? WHERE id = ?").run(message, materialId);
    throw e;
  }
}

export function deleteMaterial(id: string): void {
  const m = getMaterial(id);
  if (!m) return;
  try {
    fs.rmSync(m.stored_path, { force: true });
  } catch {
    /* ignore */
  }
  removeDerivedImages(m.subject_id, id);
  getDb().prepare("DELETE FROM materials WHERE id = ?").run(id);
}
