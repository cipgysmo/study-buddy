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

export interface ReportArea {
  id: string;
  name: string;
  kind: "topic" | "container";
  subject_id: string | null;
  attempts: number;
  correct: number;
  incorrect: number;
  avgScore: number | null;
  accuracy: number | null;
}

function parseIdArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function getSkillReport(subjectId?: string): { topics: ReportArea[]; containers: ReportArea[] } {
  const db = getDb();
  const where = subjectId ? "WHERE a.subject_id = ?" : "";
  const args = subjectId ? [subjectId] : [];

  const rows = [
    ...db
      .prepare(
        `SELECT a.subject_id, a.correct, a.score, i.topic_ids, i.column_ids
         FROM activity_attempts a JOIN quizzes i ON i.id = a.item_id ${where}`
      )
      .all(...args),
    ...db
      .prepare(
        `SELECT a.subject_id, a.correct, a.score, i.topic_ids, i.column_ids
         FROM activity_attempts a JOIN exercises i ON i.id = a.item_id ${where}`
      )
      .all(...args),
    ...db
      .prepare(
        `SELECT a.subject_id, a.correct, a.score, i.topic_ids, i.column_ids
         FROM activity_attempts a JOIN truefalse i ON i.id = a.item_id ${where}`
      )
      .all(...args),
    ...db
      .prepare(
        `SELECT a.subject_id, a.correct, a.score, i.topic_ids, i.column_ids
         FROM activity_attempts a JOIN typed_exercises i ON i.id = a.item_id ${where}`
      )
      .all(...args),
  ] as {
    subject_id: string | null;
    correct: number | null;
    score: number | null;
    topic_ids: string | null;
    column_ids: string | null;
  }[];

  const topicIds = new Set<string>();
  const columnIds = new Set<string>();
  const stats = new Map<string, { kind: "topic" | "container"; id: string; subject_id: string | null; attempts: number; correct: number; incorrect: number; scoreSum: number; scoreCount: number }>();

  for (const row of rows) {
    for (const id of parseIdArray(row.topic_ids)) topicIds.add(id);
    for (const id of parseIdArray(row.column_ids)) columnIds.add(id);

    for (const id of parseIdArray(row.topic_ids)) {
      const key = `topic:${id}`;
      const s = stats.get(key) ?? { kind: "topic", id, subject_id: row.subject_id, attempts: 0, correct: 0, incorrect: 0, scoreSum: 0, scoreCount: 0 };
      s.attempts++;
      if (row.correct === 1) s.correct++;
      if (row.correct === 0) s.incorrect++;
      if (typeof row.score === "number") {
        s.scoreSum += row.score;
        s.scoreCount++;
      }
      stats.set(key, s);
    }

    for (const id of parseIdArray(row.column_ids)) {
      const key = `container:${id}`;
      const s = stats.get(key) ?? { kind: "container", id, subject_id: row.subject_id, attempts: 0, correct: 0, incorrect: 0, scoreSum: 0, scoreCount: 0 };
      s.attempts++;
      if (row.correct === 1) s.correct++;
      if (row.correct === 0) s.incorrect++;
      if (typeof row.score === "number") {
        s.scoreSum += row.score;
        s.scoreCount++;
      }
      stats.set(key, s);
    }
  }

  const names = new Map<string, string>();
  if (topicIds.size > 0) {
    const rows = db.prepare(`SELECT id, name FROM topics WHERE id IN (${[...topicIds].map(() => "?").join(",")})`).all(...topicIds) as { id: string; name: string }[];
    for (const r of rows) names.set(`topic:${r.id}`, r.name);
  }
  if (columnIds.size > 0) {
    const rows = db.prepare(`SELECT id, name FROM board_columns WHERE id IN (${[...columnIds].map(() => "?").join(",")})`).all(...columnIds) as { id: string; name: string }[];
    for (const r of rows) names.set(`container:${r.id}`, r.name);
  }

  const areas: ReportArea[] = [];
  for (const [key, s] of stats.entries()) {
    const name = names.get(key);
    if (!name) continue;
    const graded = s.correct + s.incorrect;
    areas.push({
      id: s.id,
      name,
      kind: s.kind,
      subject_id: s.subject_id,
      attempts: s.attempts,
      correct: s.correct,
      incorrect: s.incorrect,
      avgScore: s.scoreCount > 0 ? Math.round(s.scoreSum / s.scoreCount) : null,
      accuracy: graded > 0 ? Math.round((s.correct / graded) * 100) : null,
    });
  }

  return {
    topics: areas.filter((a) => a.kind === "topic").sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0)),
    containers: areas.filter((a) => a.kind === "container").sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0)),
  };
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
