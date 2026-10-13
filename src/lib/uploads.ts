import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getDb } from "./db";
import { dataDir, maxUploadBytes, maxUploadChunkBytes } from "./env";
import { addMaterialFromStoredFile } from "./subjects";

export interface UploadSession {
  id: string;
  subject_id: string;
  filename: string;
  mime: string;
  size: number;
  role: "notes" | "exam";
  container_name: string;
  temp_path: string;
  total_chunks: number;
  received_chunks: number;
  received_bytes: number;
  status: "uploading" | "complete" | "cancelled" | "failed";
  error: string | null;
  created_at: string;
  updated_at: string;
}

export class UploadError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function uploadRoot(): string {
  return path.join(dataDir(), "uploads", "_chunks");
}

function tempPathFor(id: string): string {
  return path.join(uploadRoot(), `${id}.part`);
}

export function getUploadSession(id: string): UploadSession | null {
  const row = getDb().prepare("SELECT * FROM upload_sessions WHERE id = ?").get(id) as
    | UploadSession
    | undefined;
  return row ?? null;
}

export async function createUploadSession(input: {
  subjectId: string;
  filename: string;
  mime: string;
  size: number;
  totalChunks: number;
  role: "notes" | "exam";
  containerName: string;
}): Promise<UploadSession> {
  if (!input.filename.trim()) throw new UploadError(400, "filename_required");
  if (!Number.isFinite(input.size) || input.size <= 0) throw new UploadError(400, "size_required");
  if (input.size > maxUploadBytes()) throw new UploadError(413, "file_too_large");
  if (!Number.isFinite(input.totalChunks) || input.totalChunks <= 0) {
    throw new UploadError(400, "total_chunks_required");
  }
  if (input.totalChunks > 100_000) throw new UploadError(400, "too_many_chunks");

  void cleanupStaleUploadSessions().catch(() => undefined);

  const id = randomUUID();
  const tempPath = tempPathFor(id);
  await fs.mkdir(uploadRoot(), { recursive: true });
  await fs.writeFile(tempPath, Buffer.alloc(0));

  getDb()
    .prepare(
      `INSERT INTO upload_sessions
        (id, subject_id, filename, mime, size, role, container_name, temp_path, total_chunks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.subjectId,
      input.filename.trim(),
      input.mime || "application/octet-stream",
      input.size,
      input.role,
      input.containerName.trim(),
      tempPath,
      input.totalChunks
    );

  return getUploadSession(id)!;
}

export async function appendUploadChunk(id: string, chunkIndex: number, buffer: Buffer): Promise<UploadSession> {
  const session = getUploadSession(id);
  if (!session) throw new UploadError(404, "upload_not_found");
  if (session.status !== "uploading") throw new UploadError(409, `upload_${session.status}`);
  if (chunkIndex !== session.received_chunks) throw new UploadError(409, "chunk_out_of_order");
  if (chunkIndex >= session.total_chunks) throw new UploadError(400, "chunk_index_invalid");
  if (buffer.length === 0) throw new UploadError(400, "empty_chunk");
  if (buffer.length > maxUploadChunkBytes()) throw new UploadError(413, "chunk_too_large");
  if (session.received_bytes + buffer.length > session.size) throw new UploadError(413, "upload_overflow");

  await fs.appendFile(session.temp_path, buffer);
  getDb()
    .prepare(
      `UPDATE upload_sessions
       SET received_chunks = received_chunks + 1,
           received_bytes = received_bytes + ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(buffer.length, id);

  return getUploadSession(id)!;
}

export async function completeUploadSession(id: string): Promise<UploadSession> {
  const session = getUploadSession(id);
  if (!session) throw new UploadError(404, "upload_not_found");
  if (session.status === "complete") return session;
  if (session.status !== "uploading") throw new UploadError(409, `upload_${session.status}`);
  if (session.received_chunks !== session.total_chunks || session.received_bytes !== session.size) {
    throw new UploadError(409, "upload_incomplete");
  }

  const ext = path.extname(session.filename);
  const finalDir = path.join(dataDir(), "uploads", session.subject_id);
  const finalPath = path.join(finalDir, `${session.id}${ext}`);
  await fs.mkdir(finalDir, { recursive: true });
  await fs.rename(session.temp_path, finalPath);

  getDb()
    .prepare("UPDATE upload_sessions SET status = 'complete', updated_at = datetime('now') WHERE id = ?")
    .run(id);

  return getUploadSession(id)!;
}

export function createMaterialFromUploadSession(session: UploadSession) {
  return addMaterialFromStoredFile(
    session.id,
    session.subject_id,
    {
      filename: session.filename,
      mime: session.mime,
      storedPath: path.join(dataDir(), "uploads", session.subject_id, `${session.id}${path.extname(session.filename)}`),
      size: session.size,
    },
    session.role
  );
}

export async function cancelUploadSession(id: string): Promise<UploadSession | null> {
  const session = getUploadSession(id);
  if (!session) return null;
  if (session.status === "uploading") {
    try {
      await fs.rm(session.temp_path, { force: true });
    } catch {
      /* ignore */
    }
    getDb()
      .prepare("UPDATE upload_sessions SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?")
      .run(id);
  }
  return getUploadSession(id);
}

export async function cleanupStaleUploadSessions(maxAgeHours = 24): Promise<number> {
  const rows = getDb()
    .prepare(
      `SELECT id, temp_path
       FROM upload_sessions
       WHERE status = 'uploading'
         AND datetime(updated_at) < datetime('now', ?)`
    )
    .all(`-${Math.max(1, Math.floor(maxAgeHours))} hours`) as { id: string; temp_path: string }[];

  for (const row of rows) {
    try {
      await fs.rm(row.temp_path, { force: true });
    } catch {
      /* ignore */
    }
    getDb()
      .prepare("UPDATE upload_sessions SET status = 'failed', error = 'stale', updated_at = datetime('now') WHERE id = ?")
      .run(row.id);
  }
  return rows.length;
}
