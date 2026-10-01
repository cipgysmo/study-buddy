import { randomUUID } from "node:crypto";
import { getDb } from "./db";

export type JobType =
  | "ocr"
  | "scan"
  | "flashcards"
  | "quiz"
  | "plan"
  | "exercises"
  | "truefalse"
  | "parseExam"
  | "similarExam"
  | "retag";

export type JobStatus = "pending" | "running" | "done" | "failed";

export interface Job {
  id: string;
  type: JobType;
  payload: string;
  status: JobStatus;
  error: string | null;
  result: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface JobContext {
  id: string;
  payload: Record<string, unknown>;
}

/** Job handler. The returned string is stored in jobs.result (e.g. OCR text, created plan id). */
type Handler = (ctx: JobContext) => Promise<string | null>;

const handlers = new Map<JobType, Handler>();

export function registerJobHandler(type: JobType, handler: Handler): void {
  handlers.set(type, handler);
}

export function enqueueJob(type: JobType, payload: Record<string, unknown>): Job {
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO jobs (id, type, payload) VALUES (?, ?, ?)")
    .run(id, type, JSON.stringify(payload));
  void pump();
  return getJob(id)!;
}

export function getJob(id: string): Job | null {
  const row = getDb().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Job | undefined;
  return row ?? null;
}

export function listActiveJobs(): Job[] {
  return getDb()
    .prepare("SELECT * FROM jobs WHERE status IN ('pending', 'running') ORDER BY created_at ASC")
    .all() as Job[];
}

/** Re-queue a failed job. Returns null when the job is missing or not in a failed state. */
export function retryJob(id: string): Job | null {
  const job = getJob(id);
  if (!job || job.status !== "failed") return null;
  getDb()
    .prepare(
      "UPDATE jobs SET status = 'pending', error = NULL, result = NULL, started_at = NULL, finished_at = NULL WHERE id = ?"
    )
    .run(id);
  void pump();
  return getJob(id);
}

// --- single-flight worker ---------------------------------------------------
// The local LLM is the bottleneck (the router peaks at 2 concurrent requests),
// so at most one job runs at a time; the rest wait in the queue. Handlers must
// be safe to re-run, because a restart re-queues jobs that were mid-flight.

let pumping = false;
let recovered = false;

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    if (!recovered) {
      recovered = true;
      getDb().prepare("UPDATE jobs SET status = 'pending' WHERE status = 'running'").run();
    }
    for (;;) {
      const db = getDb();
      const running = db
        .prepare("SELECT COUNT(*) AS n FROM jobs WHERE status = 'running'")
        .get() as { n: number };
      if (running.n > 0) break;
      const next = db
        .prepare("SELECT * FROM jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1")
        .get() as Job | undefined;
      if (!next) break;
      db.prepare("UPDATE jobs SET status = 'running', started_at = datetime('now') WHERE id = ?").run(
        next.id,
      );
      const handler = handlers.get(next.type);
      try {
        if (!handler) throw new Error(`no_handler:${next.type}`);
        const result = await handler({ id: next.id, payload: JSON.parse(next.payload) });
        db.prepare(
          "UPDATE jobs SET status = 'done', result = ?, finished_at = datetime('now') WHERE id = ?"
        ).run(result, next.id);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        db.prepare(
          "UPDATE jobs SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?"
        ).run(message, next.id);
      }
    }
  } finally {
    pumping = false;
  }
}
