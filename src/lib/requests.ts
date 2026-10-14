import { getDb } from "./db";
import type { JobStatus, JobType } from "./jobs";

export interface GenerationRequest {
  id: string;
  type: JobType;
  status: JobStatus;
  created_at: string;
  finished_at: string | null;
  error: string | null;
  result: string | null;
  subject_id: string | null;
  subject_name: string | null;
  payload: Record<string, unknown>;
}

const GENERATION_TYPES: JobType[] = [
  "flashcards",
  "quiz",
  "plan",
  "exercises",
  "truefalse",
  "typedexercises",
  "lesson",
];

export function listGenerationRequests(limit = 100, offset = 0): GenerationRequest[] {
  const placeholders = GENERATION_TYPES.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT j.*, s.name AS subject_name
       FROM jobs j
       LEFT JOIN subjects s ON s.id = json_extract(j.payload, '$.subjectId')
       WHERE j.type IN (${placeholders})
       ORDER BY j.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...GENERATION_TYPES, limit, offset) as (Omit<GenerationRequest, "payload" | "subject_name"> & {
    payload: string;
    subject_name: string | null;
  })[];

  return rows.map((row) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      created_at: row.created_at,
      finished_at: row.finished_at,
      error: row.error,
      result: row.result,
      subject_id: typeof payload.subjectId === "string" ? payload.subjectId : null,
      subject_name: row.subject_name,
      payload,
    };
  });
}
