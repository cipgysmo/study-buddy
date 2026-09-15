import { randomUUID } from "node:crypto";
import { LANGUAGES } from "@/i18n/languages";
import { buildSubjectContext } from "./context";
import { getDb } from "./db";
import { resolveLocale } from "./locale";
import { chatJSON } from "./llm";
import { planGeneratorPrompt, type PlanDraft } from "./prompts/plan";
import { getSubject } from "./subjects";

export interface StudyPlan {
  id: string;
  subject_id: string;
  title: string;
  exam_date: string;
  target_grade: string | null;
  status: string;
  created_at: string;
}

export interface PlanItem {
  id: string;
  plan_id: string;
  day_index: number;
  date: string;
  topic: string;
  instructions: string;
  done: number;
  sort_order: number;
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00Z");
  const to = new Date(toISO + "T00:00:00Z");
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function listPlans(): StudyPlan[] {
  return getDb()
    .prepare("SELECT * FROM study_plans ORDER BY created_at DESC")
    .all() as StudyPlan[];
}

export function getPlan(id: string): StudyPlan | null {
  const row = getDb()
    .prepare("SELECT * FROM study_plans WHERE id = ?")
    .get(id) as StudyPlan | undefined;
  return row ?? null;
}

export function listPlanItems(planId: string): PlanItem[] {
  return getDb()
    .prepare("SELECT * FROM plan_items WHERE plan_id = ? ORDER BY day_index ASC, sort_order ASC")
    .all(planId) as PlanItem[];
}

export function deletePlan(id: string): void {
  getDb().prepare("DELETE FROM study_plans WHERE id = ?").run(id);
}

export function setItemDone(planItemId: string, done: boolean): void {
  getDb().prepare("UPDATE plan_items SET done = ? WHERE id = ?").run(done ? 1 : 0, planItemId);
}

export async function createPlan(opts: {
  subjectId: string;
  title: string;
  examDate: string;
  targetGrade?: string | null;
}): Promise<StudyPlan> {
  const subject = getSubject(opts.subjectId);
  if (!subject) throw new Error("subject_not_found");

  const today = todayISO();
  const diff = daysBetween(today, opts.examDate);
  const daysAvailable = Math.max(1, diff + 1);

  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
  const context = buildSubjectContext(opts.subjectId);

  const draft = await chatJSON<PlanDraft>({
    messages: [
      {
        role: "user",
        content: planGeneratorPrompt({
          language: languageName,
          subjectName: subject.name,
          daysAvailable,
          targetGrade: opts.targetGrade ?? null,
          context,
        }),
      },
    ],
    temperature: 0.4,
  });

  const id = randomUUID();
  const db = getDb();
  db.prepare(
    "INSERT INTO study_plans (id, subject_id, title, exam_date, target_grade) VALUES (?, ?, ?, ?, ?)"
  ).run(id, opts.subjectId, draft.title?.trim() || opts.title, opts.examDate, opts.targetGrade ?? null);

  const insertItem = db.prepare(
    "INSERT INTO plan_items (id, plan_id, day_index, date, topic, instructions, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const items = (draft.items ?? []).slice(0, daysAvailable);
  items.forEach((it, i) => {
    const dayIndex = Number.isFinite(it.dayIndex) ? it.dayIndex : i;
    insertItem.run(
      randomUUID(),
      id,
      dayIndex,
      addDays(today, dayIndex),
      it.topic ?? "",
      it.instructions ?? "",
      i
    );
  });

  return getPlan(id)!;
}
