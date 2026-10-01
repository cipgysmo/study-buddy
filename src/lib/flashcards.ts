import { randomUUID } from "node:crypto";
import { fsrs, Rating, type CardInput, type Grade } from "ts-fsrs";
import { LANGUAGES } from "@/i18n/languages";
import { buildSubjectContext } from "./context";
import { getDb } from "./db";
import { resolveLocale } from "./locale";
import { chatJSON } from "./llm";
import { flashcardGeneratorPrompt, type FlashcardDraft } from "./prompts/flashcards";
import { getSubject } from "./subjects";
import { topicNames } from "./topics";

const scheduler = fsrs();

export interface Flashcard {
  id: string;
  subject_id: string;
  front: string;
  back: string;
  ease: number;
  interval: number;
  reps: number;
  due_at: string;
  stability: number;
  difficulty: number;
  state: number;
  lapses: number;
  last_review: string | null;
  created_at: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function listFlashcards(subjectId?: string): Flashcard[] {
  if (subjectId) {
    return getDb()
      .prepare("SELECT * FROM flashcards WHERE subject_id = ? ORDER BY created_at DESC")
      .all(subjectId) as Flashcard[];
  }
  return getDb().prepare("SELECT * FROM flashcards ORDER BY created_at DESC").all() as Flashcard[];
}

export function dueFlashcards(subjectId?: string): Flashcard[] {
  const today = todayISO();
  if (subjectId) {
    return getDb()
      .prepare("SELECT * FROM flashcards WHERE subject_id = ? AND due_at <= ? ORDER BY due_at ASC")
      .all(subjectId, today) as Flashcard[];
  }
  return getDb()
    .prepare("SELECT * FROM flashcards WHERE due_at <= ? ORDER BY due_at ASC")
    .all(today) as Flashcard[];
}

export function getFlashcard(id: string): Flashcard | null {
  const row = getDb().prepare("SELECT * FROM flashcards WHERE id = ?").get(id) as Flashcard | undefined;
  return row ?? null;
}

export function deleteFlashcard(id: string): void {
  getDb().prepare("DELETE FROM flashcards WHERE id = ?").run(id);
}

export async function generateFlashcards(
  subjectId: string,
  count: number,
  topicIds?: string[]
): Promise<Flashcard[]> {
  const subject = getSubject(subjectId);
  if (!subject) throw new Error("subject_not_found");
  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
  const context = buildSubjectContext(subjectId, topicIds);

  const draft = await chatJSON<FlashcardDraft>({
    messages: [
      {
        role: "user",
        content: flashcardGeneratorPrompt({
          language: languageName,
          subjectName: subject.name,
          count,
          context,
          topics: topicNames(topicIds ?? []),
        }),
      },
    ],
    temperature: 0.5,
  });

  const today = todayISO();
  const insert = getDb().prepare(
    "INSERT INTO flashcards (id, subject_id, front, back, ease, interval, reps, due_at, stability, difficulty, state, lapses, last_review) VALUES (?, ?, ?, ?, 2.5, 0, 0, ?, 0, 0, 0, 0, NULL)"
  );
  const created: Flashcard[] = [];
  for (const fc of (draft.cards ?? []).slice(0, count)) {
    if (!fc.front || !fc.back) continue;
    const id = randomUUID();
    insert.run(id, subjectId, fc.front, fc.back, today);
    created.push(getDb().prepare("SELECT * FROM flashcards WHERE id = ?").get(id) as Flashcard);
  }
  return created;
}

/**
 * Review a card with an FSRS grade (1=Again, 2=Hard, 3=Good, 4=Easy).
 * Updates the card's memory state and records a review log.
 */
export function reviewFlashcard(id: string, rating: number): Flashcard | null {
  const card = getFlashcard(id);
  if (!card) return null;
  const grade = Math.round(rating) as Grade;
  if (grade < Rating.Again || grade > Rating.Easy) return card;

  const now = new Date();
  const input: CardInput = {
    due: new Date(card.due_at + "T00:00:00Z"),
    stability: card.stability,
    difficulty: card.difficulty,
    state: card.state,
    reps: card.reps,
    lapses: card.lapses,
    last_review: card.last_review ? new Date(card.last_review) : null,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
  };
  const { card: next, log } = scheduler.next(input, now, grade);
  const dueISO = next.due.toISOString().slice(0, 10);
  const reviewedISO = now.toISOString();

  let retention: number | null = null;
  if (card.last_review) {
    try {
      retention = scheduler.get_retrievability(input, now, false);
    } catch {
      retention = null;
    }
  }

  const db = getDb();
  db.prepare(
    "UPDATE flashcards SET stability = ?, difficulty = ?, state = ?, reps = ?, lapses = ?, due_at = ?, last_review = ? WHERE id = ?"
  ).run(next.stability, next.difficulty, next.state, next.reps, next.lapses, dueISO, reviewedISO, id);
  db.prepare(
    "INSERT INTO review_logs (id, card_id, reviewed_at, rating, state, stability, difficulty, scheduled_days, retention) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    randomUUID(),
    id,
    reviewedISO,
    grade,
    next.state,
    next.stability,
    next.difficulty,
    log.scheduled_days,
    retention
  );
  return getFlashcard(id);
}
