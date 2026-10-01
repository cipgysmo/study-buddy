import { fsrs, type CardInput } from "ts-fsrs";
import { getDb } from "./db";
import { dueFlashcards, listFlashcards } from "./flashcards";
import { listSubjects } from "./subjects";

const retentionScheduler = fsrs();

export interface ProgressData {
  totals: {
    subjects: number;
    materials: number;
    flashcards: number;
    quizzes: number;
    quizAttempts: number;
    chatMessages: number;
  };
  activity: { date: string; count: number }[];
  streak: { current: number; best: number };
  mastery: { subjectId: string; name: string; score: number }[];
  retention: {
    predicted: number | null;
    totalReviews: number;
    dueToday: number;
    heatmap: { date: string; count: number }[];
  };
}

/** Average probability of recall right now, across all reviewed cards. */
function predictedRetention(): number | null {
  const cards = listFlashcards().filter((c) => c.last_review);
  if (!cards.length) return null;
  const now = new Date();
  let sum = 0;
  for (const c of cards) {
    const input: CardInput = {
      due: new Date(c.due_at + "T00:00:00Z"),
      stability: c.stability,
      difficulty: c.difficulty,
      state: c.state,
      reps: c.reps,
      lapses: c.lapses,
      last_review: c.last_review ? new Date(c.last_review) : null,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
    };
    try {
      sum += retentionScheduler.get_retrievability(input, now, false);
    } catch {
      /* skip uncomputable card */
    }
  }
  return sum / cards.length;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function getProgress(): ProgressData {
  const db = getDb();
  const count = (sql: string, ...p: unknown[]) =>
    (db.prepare(sql).get(...p) as { n: number } | undefined)?.n ?? 0;

  const totals = {
    subjects: count("SELECT COUNT(*) n FROM subjects"),
    materials: count("SELECT COUNT(*) n FROM materials"),
    flashcards: count("SELECT COUNT(*) n FROM flashcards"),
    quizzes: count("SELECT COUNT(*) n FROM quizzes"),
    quizAttempts: count("SELECT COUNT(*) n FROM quiz_attempts"),
    chatMessages: count("SELECT COUNT(*) n FROM chat_messages WHERE role = 'user'"),
  };

  const dayCounts = new Map<string, number>();
  const add = (iso: string | null | undefined) => {
    if (!iso) return;
    const k = dayKey(iso);
    dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
  };
  for (const r of db
    .prepare("SELECT created_at FROM chat_messages WHERE role = 'user'")
    .all() as { created_at: string }[])
    add(r.created_at);
  for (const r of db.prepare("SELECT taken_at FROM quiz_attempts").all() as { taken_at: string }[])
    add(r.taken_at);
  for (const r of db.prepare("SELECT created_at FROM flashcards").all() as { created_at: string }[])
    add(r.created_at);
  for (const r of db.prepare("SELECT created_at FROM materials").all() as { created_at: string }[])
    add(r.created_at);

  const days = lastNDays(14);
  const activity = days.map((date) => ({ date, count: dayCounts.get(date) ?? 0 }));

  const activeDays = new Set(dayCounts.keys());
  const cursor = new Date();
  if (!activeDays.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let current = 0;
  while (activeDays.has(cursor.toISOString().slice(0, 10))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sorted = [...activeDays].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev) {
      const diff = Math.round((new Date(d).getTime() - new Date(prev).getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }

  const mastery = listSubjects().map((s) => {
    const attempts = db
      .prepare(
        "SELECT score, total FROM quiz_attempts WHERE quiz_id IN (SELECT id FROM quizzes WHERE subject_id = ?)"
      )
      .all(s.id) as { score: number; total: number }[];
    let quizScore = 0;
    if (attempts.length) {
      const pct = attempts.reduce((a, b) => a + (b.total ? b.score / b.total : 0), 0) / attempts.length;
      quizScore = pct * 100;
    }
    const cards = db
      .prepare("SELECT state FROM flashcards WHERE subject_id = ?")
      .all(s.id) as { state: number }[];
    let cardScore = 0;
    if (cards.length) {
      const learned = cards.filter((c) => c.state >= 2).length;
      cardScore = (learned / cards.length) * 100;
    }
    const parts: number[] = [];
    if (attempts.length) parts.push(quizScore);
    if (cards.length) parts.push(cardScore);
    const score = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;
    return { subjectId: s.id, name: s.name, score };
  });

  const HEATMAP_DAYS = 112;
  const reviewCounts = new Map<string, number>();
  for (const r of db.prepare("SELECT reviewed_at FROM review_logs").all() as { reviewed_at: string }[]) {
    const k = dayKey(r.reviewed_at);
    reviewCounts.set(k, (reviewCounts.get(k) ?? 0) + 1);
  }
  const heatmap = lastNDays(HEATMAP_DAYS).map((date) => ({ date, count: reviewCounts.get(date) ?? 0 }));
  const totalReviews = (db.prepare("SELECT COUNT(*) n FROM review_logs").get() as { n: number }).n;
  const retention = {
    predicted: predictedRetention(),
    totalReviews,
    dueToday: dueFlashcards().length,
    heatmap,
  };

  return { totals, activity, streak: { current, best }, mastery, retention };
}
