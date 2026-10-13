import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { parseListQuery, pagedResult, type PagedResult } from "./list-query";

export type AttemptKind = "quiz" | "typed" | "truefalse" | "exercise";

export interface ActivityAttempt {
  id: string;
  subject_id: string | null;
  kind: AttemptKind;
  item_id: string;
  question_id: string | null;
  correct: boolean | null;
  score: number | null;
  payload: string | null;
  created_at: string;
}

export interface WeakSpot {
  subject_id: string | null;
  subject_name: string;
  kind: AttemptKind;
  attempts: number;
  incorrect: number;
  avg_score: number | null;
}

export function recordAttempt(input: {
  subjectId?: string | null;
  kind: AttemptKind;
  itemId: string;
  questionId?: string | null;
  correct?: boolean | null;
  score?: number | null;
  payload?: unknown;
}): string {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO activity_attempts
        (id, subject_id, kind, item_id, question_id, correct, score, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.subjectId ?? null,
      input.kind,
      input.itemId,
      input.questionId ?? null,
      input.correct == null ? null : input.correct ? 1 : 0,
      input.score ?? null,
      input.payload === undefined ? null : JSON.stringify(input.payload)
    );
  return id;
}

export function listAttemptsPage(params: URLSearchParams): PagedResult<ActivityAttempt & { subject_name: string | null }> {
  const q = parseListQuery(params);
  const where: string[] = [];
  const args: unknown[] = [];
  const kind = params.get("kind");
  const subjectId = params.get("subjectId") ?? params.get("subject");
  if (kind) {
    where.push("a.kind = ?");
    args.push(kind);
  }
  if (subjectId) {
    where.push("a.subject_id = ?");
    args.push(subjectId);
  }
  if (q.search) {
    where.push("lower(s.name) LIKE ?");
    args.push(`%${q.search.toLowerCase()}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (
    getDb()
      .prepare(`SELECT COUNT(*) AS n FROM activity_attempts a LEFT JOIN subjects s ON s.id = a.subject_id ${whereSql}`)
      .get(...args) as { n: number }
  ).n;
  const items = getDb()
    .prepare(
      `SELECT a.*, s.name AS subject_name
       FROM activity_attempts a
       LEFT JOIN subjects s ON s.id = a.subject_id
       ${whereSql}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...args, q.limit, q.offset) as (ActivityAttempt & { subject_name: string | null })[];
  return pagedResult(items, total, q.limit, q.offset);
}

export function getWeakSpots(subjectId?: string): WeakSpot[] {
  const where = subjectId ? "WHERE a.subject_id = ?" : "";
  const args = subjectId ? [subjectId] : [];
  const rows = getDb()
    .prepare(
      `SELECT
         a.subject_id,
         COALESCE(s.name, '—') AS subject_name,
         a.kind,
         COUNT(*) AS attempts,
         SUM(CASE WHEN a.correct = 0 THEN 1 ELSE 0 END) AS incorrect,
         AVG(a.score) AS avg_score
       FROM activity_attempts a
       LEFT JOIN subjects s ON s.id = a.subject_id
       ${where}
       GROUP BY a.subject_id, a.kind
       HAVING incorrect > 0
       ORDER BY incorrect DESC, attempts DESC`
    )
    .all(...args) as {
    subject_id: string | null;
    subject_name: string;
    kind: AttemptKind;
    attempts: number;
    incorrect: number;
    avg_score: number | null;
  }[];
  return rows;
}
