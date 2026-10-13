import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import { dataDir } from "./env";
import { extractTextFromFile, kindFromMime, type MaterialKind } from "./extract";
import { ocrImage } from "./ocr";
import { processPdfMaterial } from "./pdf";
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
  extracted_text_path: string | null;
  extracted_text_length: number;
  page_count: number | null;
  status: "processing" | "ready" | "failed";
  error: string | null;
  job_id: string | null;
  /** "notes" = study content; "exam" = a school exam paper used as a template. */
  role: "notes" | "exam";
  /** Job that parses an exam paper into questions (role = "exam" only). */
  parse_job_id: string | null;
  created_at: string;
}

export type MaterialSummary = Omit<Material, "extracted_text" | "extracted_text_path">;

const INLINE_EXTRACTED_TEXT_LIMIT = 100_000;

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
    .prepare("SELECT stored_path, extracted_text_path FROM materials WHERE subject_id = ?")
    .all(id) as { stored_path: string; extracted_text_path: string | null }[];
  for (const m of materials) {
    try {
      fs.rmSync(m.stored_path, { force: true });
    } catch {
      /* ignore */
    }
    if (m.extracted_text_path) {
      try {
        fs.rmSync(m.extracted_text_path, { force: true });
      } catch {
        /* ignore */
      }
    }
  }
  removeDerivedDir(id);
  getDb().prepare("DELETE FROM subjects WHERE id = ?").run(id);
}

export function listMaterials(subjectId: string): MaterialSummary[] {
  return getDb()
    .prepare(
      `SELECT id, subject_id, filename, stored_path, mime, kind, size,
              extracted_text_length, page_count, status, error, job_id,
              role, parse_job_id, created_at
       FROM materials
       WHERE subject_id = ?
       ORDER BY created_at DESC`
    )
    .all(subjectId) as MaterialSummary[];
}

export function getMaterial(id: string): Material | null {
  const row = getDb()
    .prepare("SELECT * FROM materials WHERE id = ?")
    .get(id) as Material | undefined;
  return row ?? null;
}

export function getMaterialText(materialId: string): string | null {
  const m = getMaterial(materialId);
  if (!m) return null;
  if (m.extracted_text != null) return m.extracted_text;
  if (m.extracted_text_path) {
    try {
      return fs.readFileSync(m.extracted_text_path, "utf-8");
    } catch {
      return null;
    }
  }
  return null;
}

export function setMaterialExtractedText(materialId: string, text: string | null): void {
  const m = getMaterial(materialId);
  if (!m) return;
  const length = text?.length ?? 0;
  const db = getDb();

  if (text && length > INLINE_EXTRACTED_TEXT_LIMIT) {
    const extractedPath = path.join(dataDir(), "uploads", m.subject_id, `${materialId}.extracted.txt`);
    fs.mkdirSync(path.dirname(extractedPath), { recursive: true });
    fs.writeFileSync(extractedPath, text, "utf-8");
    if (m.extracted_text_path && m.extracted_text_path !== extractedPath) {
      try {
        fs.rmSync(m.extracted_text_path, { force: true });
      } catch {
        /* ignore */
      }
    }
    db.prepare(
      `UPDATE materials
       SET extracted_text = NULL, extracted_text_path = ?, extracted_text_length = ?,
           status = 'ready', error = NULL
       WHERE id = ?`
    ).run(extractedPath, length, materialId);
    return;
  }

  if (m.extracted_text_path) {
    try {
      fs.rmSync(m.extracted_text_path, { force: true });
    } catch {
      /* ignore */
    }
  }
  db.prepare(
    `UPDATE materials
     SET extracted_text = ?, extracted_text_path = NULL, extracted_text_length = ?,
         status = 'ready', error = NULL
     WHERE id = ?`
  ).run(text, length, materialId);
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

/** Insert a material row for a file that has already been written to its final path. */
export function addMaterialFromStoredFile(
  id: string,
  subjectId: string,
  file: { filename: string; mime: string; storedPath: string; size: number },
  role: "notes" | "exam" = "notes"
): Material {
  const kind = kindFromMime(file.mime, file.filename);
  getDb()
    .prepare(
      `INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing')`
    )
    .run(id, subjectId, file.filename, file.storedPath, file.mime, kind, file.size, role);
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
      `INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size, extracted_text, extracted_text_length, status, job_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?)`
    )
    .run(
      id,
      subjectId,
      file.filename,
      storedPath,
      file.mime,
      kind,
      file.buffer.length,
      text,
      text.length,
      jobId ?? null
    );
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
    let text: string | null;
    if (m.kind === "pdf") {
      text = await processPdfMaterial(m);
    } else {
      text = await extractTextFromFile(m.stored_path, m.kind);
      if (m.kind === "image" && !text) {
        const buffer = fs.readFileSync(m.stored_path);
        text = await ocrImage(buffer, m.mime);
      }
    }
    setMaterialExtractedText(materialId, text);
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
  if (m.extracted_text_path) {
    try {
      fs.rmSync(m.extracted_text_path, { force: true });
    } catch {
      /* ignore */
    }
  }
  const pages = getDb()
    .prepare("SELECT image_path FROM material_pages WHERE material_id = ?")
    .all(id) as { image_path: string | null }[];
  for (const page of pages) {
    if (page.image_path) {
      try {
        fs.rmSync(page.image_path, { force: true });
      } catch {
        /* ignore */
      }
    }
  }
  try {
    fs.rmSync(path.join(dataDir(), "uploads", m.subject_id, id), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  removeDerivedImages(m.subject_id, id);
  getDb().prepare("DELETE FROM materials WHERE id = ?").run(id);
}
