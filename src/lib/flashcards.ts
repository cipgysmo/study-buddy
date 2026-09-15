import { randomUUID } from "node:crypto";
import { LANGUAGES } from "@/i18n/languages";
import { buildSubjectContext } from "./context";
import { getDb } from "./db";
import { resolveLocale } from "./locale";
import { chatJSON } from "./llm";
import { flashcardGeneratorPrompt, type FlashcardDraft } from "./prompts/flashcards";
import { getSubject } from "./subjects";
import { sm2 } from "./sm2";

export interface Flashcard {
  id: string;
  subject_id: string;
  front: string;
  back: string;
  ease: number;
  interval: number;
  reps: number;
  due_at: string;
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

export async function generateFlashcards(subjectId: string, count: number): Promise<Flashcard[]> {
  const subject = getSubject(subjectId);
  if (!subject) throw new Error("subject_not_found");
  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
  const context = buildSubjectContext(subjectId);

  const draft = await chatJSON<FlashcardDraft>({
    messages: [
      {
        role: "user",
        content: flashcardGeneratorPrompt({
          language: languageName,
          subjectName: subject.name,
          count,
          context,
        }),
      },
    ],
    temperature: 0.5,
  });

  const today = todayISO();
  const insert = getDb().prepare(
    "INSERT INTO flashcards (id, subject_id, front, back, ease, interval, reps, due_at) VALUES (?, ?, ?, ?, 2.5, 0, 0, ?)"
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

export function reviewFlashcard(id: string, quality: number): Flashcard | null {
  const card = getFlashcard(id);
  if (!card) return null;
  const result = sm2({ ease: card.ease, interval: card.interval, reps: card.reps }, quality, todayISO());
  getDb()
    .prepare("UPDATE flashcards SET ease = ?, interval = ?, reps = ?, due_at = ? WHERE id = ?")
    .run(result.ease, result.interval, result.reps, result.dueISO, id);
  return getFlashcard(id);
}
