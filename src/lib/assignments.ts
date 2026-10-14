import { randomUUID } from "node:crypto";
import { getDb } from "./db";

export type AssignmentType =
  | "custom"
  | "lesson"
  | "quiz"
  | "mock_exam"
  | "material"
  | "flashcards"
  | "exercises"
  | "truefalse"
  | "typed";

export type AssignmentStatus = "todo" | "done";

export interface Student {
  id: string;
  name: string;
  created_at: string;
}

export interface Assignment {
  id: string;
  student_id: string | null;
  subject_id: string | null;
  type: AssignmentType;
  title: string;
  description: string;
  target_id: string | null;
  due_at: string | null;
  status: AssignmentStatus;
  sort_order: number;
  created_at: string;
  completed_at: string | null;
  student_name?: string | null;
  subject_name?: string | null;
}

export interface TemplateItem {
  id: string;
  template_id: string;
  type: AssignmentType;
  title: string;
  description: string;
  subject_id: string | null;
  target_id: string | null;
  due_offset_days: number;
  sort_order: number;
}

export interface AssignmentTemplate {
  id: string;
  name: string;
  description: string;
  created_at: string;
  items: TemplateItem[];
}

const ASSIGNMENT_TYPES: AssignmentType[] = [
  "custom",
  "lesson",
  "quiz",
  "mock_exam",
  "material",
  "flashcards",
  "exercises",
  "truefalse",
  "typed",
];

function cleanType(value: unknown): AssignmentType {
  return typeof value === "string" && (ASSIGNMENT_TYPES as string[]).includes(value)
    ? (value as AssignmentType)
    : "custom";
}

function cleanText(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanNullableText(value: unknown, max = 200): string | null {
  const text = cleanText(value, max);
  return text || null;
}

function cleanDate(value: unknown): string | null {
  const text = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanOffset(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  return Math.max(0, Math.min(365, n));
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function listStudents(): Student[] {
  return getDb().prepare("SELECT * FROM students ORDER BY created_at ASC, rowid ASC").all() as Student[];
}

export function getStudent(id: string): Student | null {
  return (getDb().prepare("SELECT * FROM students WHERE id = ?").get(id) as
    | Student
    | undefined) ?? null;
}

export function createStudent(name: string): Student {
  const trimmed = cleanText(name, 80);
  if (!trimmed) throw new Error("name_required");
  const id = randomUUID();
  getDb().prepare("INSERT INTO students (id, name) VALUES (?, ?)").run(id, trimmed);
  return getStudent(id)!;
}

export function renameStudent(id: string, name: string): Student | null {
  const trimmed = cleanText(name, 80);
  if (!trimmed) throw new Error("name_required");
  getDb().prepare("UPDATE students SET name = ? WHERE id = ?").run(trimmed, id);
  return getStudent(id);
}

export function deleteStudent(id: string): void {
  getDb().prepare("DELETE FROM students WHERE id = ?").run(id);
}

type AssignmentRow = Assignment & { student_name: string | null; subject_name: string | null };

function parseAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    student_id: row.student_id,
    subject_id: row.subject_id,
    type: cleanType(row.type),
    title: row.title,
    description: row.description,
    target_id: row.target_id,
    due_at: row.due_at,
    status: row.status === "done" ? "done" : "todo",
    sort_order: row.sort_order,
    created_at: row.created_at,
    completed_at: row.completed_at,
    student_name: row.student_name,
    subject_name: row.subject_name,
  };
}

const ASSIGNMENT_SELECT = `
  SELECT a.*, s.name AS student_name, sub.name AS subject_name
  FROM assignments a
  LEFT JOIN students s ON s.id = a.student_id
  LEFT JOIN subjects sub ON sub.id = a.subject_id
`;

export function listAssignments(opts: { status?: AssignmentStatus; studentId?: string } = {}): Assignment[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.status) {
    where.push("a.status = ?");
    params.push(opts.status);
  }
  if (opts.studentId) {
    where.push("a.student_id = ?");
    params.push(opts.studentId);
  }
  const sql = `${ASSIGNMENT_SELECT} ${
    where.length ? `WHERE ${where.join(" AND ")}` : ""
  } ORDER BY CASE WHEN a.due_at IS NULL THEN 1 ELSE 0 END, a.due_at ASC, a.sort_order ASC, a.created_at ASC`;
  const rows = getDb().prepare(sql).all(...params) as AssignmentRow[];
  return rows.map(parseAssignment);
}

export function getAssignment(id: string): Assignment | null {
  const row = getDb().prepare(`${ASSIGNMENT_SELECT} WHERE a.id = ?`).get(id) as
    | AssignmentRow
    | undefined;
  return row ? parseAssignment(row) : null;
}

export function createAssignment(input: {
  studentId?: string | null;
  subjectId?: string | null;
  type?: AssignmentType;
  title: string;
  description?: string;
  targetId?: string | null;
  dueAt?: string | null;
  sortOrder?: number;
}): Assignment {
  const title = cleanText(input.title, 200);
  if (!title) throw new Error("title_required");
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO assignments
        (id, student_id, subject_id, type, title, description, target_id, due_at, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      cleanNullableText(input.studentId),
      cleanNullableText(input.subjectId),
      cleanType(input.type),
      title,
      cleanText(input.description, 2000),
      cleanNullableText(input.targetId),
      cleanDate(input.dueAt),
      typeof input.sortOrder === "number" ? input.sortOrder : 0
    );
  return getAssignment(id)!;
}

export function updateAssignment(
  id: string,
  input: Partial<{
    studentId?: string | null;
    subjectId?: string | null;
    type?: AssignmentType;
    title?: string;
    description?: string;
    targetId?: string | null;
    dueAt?: string | null;
    status?: AssignmentStatus;
    sortOrder?: number;
  }>
): Assignment | null {
  const current = getAssignment(id);
  if (!current) return null;
  const title = input.title === undefined ? current.title : cleanText(input.title, 200);
  if (!title) throw new Error("title_required");
  const status = input.status === "done" ? "done" : input.status === "todo" ? "todo" : current.status;
  getDb()
    .prepare(
      `UPDATE assignments
       SET student_id = ?, subject_id = ?, type = ?, title = ?, description = ?, target_id = ?,
           due_at = ?, status = ?, sort_order = ?, completed_at = CASE WHEN ? = 'done' THEN datetime('now') ELSE NULL END
       WHERE id = ?`
    )
    .run(
      input.studentId === undefined ? current.student_id : cleanNullableText(input.studentId),
      input.subjectId === undefined ? current.subject_id : cleanNullableText(input.subjectId),
      input.type === undefined ? current.type : cleanType(input.type),
      title,
      input.description === undefined ? current.description : cleanText(input.description, 2000),
      input.targetId === undefined ? current.target_id : cleanNullableText(input.targetId),
      input.dueAt === undefined ? current.due_at : cleanDate(input.dueAt),
      status,
      input.sortOrder === undefined ? current.sort_order : input.sortOrder,
      status,
      id
    );
  return getAssignment(id);
}

export function completeAssignment(id: string): Assignment | null {
  return updateAssignment(id, { status: "done" });
}

export function reopenAssignment(id: string): Assignment | null {
  return updateAssignment(id, { status: "todo" });
}

export function deleteAssignment(id: string): void {
  getDb().prepare("DELETE FROM assignments WHERE id = ?").run(id);
}

type TemplateRow = Omit<AssignmentTemplate, "items">;
type TemplateItemRow = TemplateItem;

export function listTemplates(): AssignmentTemplate[] {
  const templates = getDb()
    .prepare("SELECT * FROM assignment_templates ORDER BY created_at ASC, rowid ASC")
    .all() as TemplateRow[];
  const items = getDb()
    .prepare(
      "SELECT * FROM assignment_template_items ORDER BY sort_order ASC, rowid ASC"
    )
    .all() as TemplateItemRow[];
  return templates.map((template) => ({
    ...template,
    items: items.filter((item) => item.template_id === template.id),
  }));
}

export function getTemplate(id: string): AssignmentTemplate | null {
  const template = getDb().prepare("SELECT * FROM assignment_templates WHERE id = ?").get(id) as
    | TemplateRow
    | undefined;
  if (!template) return null;
  const items = getDb()
    .prepare("SELECT * FROM assignment_template_items WHERE template_id = ? ORDER BY sort_order ASC, rowid ASC")
    .all(id) as TemplateItemRow[];
  return { ...template, items };
}

export interface TemplateItemInput {
  type?: AssignmentType;
  title: string;
  description?: string;
  subjectId?: string | null;
  targetId?: string | null;
  dueOffsetDays?: number;
}

function insertTemplateItem(templateId: string, item: TemplateItemInput, order: number): void {
  const title = cleanText(item.title, 200);
  if (!title) return;
  getDb()
    .prepare(
      `INSERT INTO assignment_template_items
        (id, template_id, type, title, description, subject_id, target_id, due_offset_days, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      templateId,
      cleanType(item.type),
      title,
      cleanText(item.description, 2000),
      cleanNullableText(item.subjectId),
      cleanNullableText(item.targetId),
      cleanOffset(item.dueOffsetDays),
      order
    );
}

export function createTemplate(input: {
  name: string;
  description?: string;
  items: TemplateItemInput[];
}): AssignmentTemplate {
  const name = cleanText(input.name, 120);
  if (!name) throw new Error("name_required");
  const id = randomUUID();
  const db = getDb();
  const run = db.transaction(() => {
    db.prepare("INSERT INTO assignment_templates (id, name, description) VALUES (?, ?, ?)").run(
      id,
      name,
      cleanText(input.description, 2000)
    );
    (input.items ?? []).forEach((item, order) => insertTemplateItem(id, item, order));
  });
  run();
  return getTemplate(id)!;
}

export function updateTemplate(
  id: string,
  input: {
    name?: string;
    description?: string;
    items?: TemplateItemInput[];
  }
): AssignmentTemplate | null {
  const current = getTemplate(id);
  if (!current) return null;
  const name = input.name === undefined ? current.name : cleanText(input.name, 120);
  if (!name) throw new Error("name_required");
  const db = getDb();
  const run = db.transaction(() => {
    db.prepare("UPDATE assignment_templates SET name = ?, description = ? WHERE id = ?").run(
      name,
      input.description === undefined ? current.description : cleanText(input.description, 2000),
      id
    );
    if (input.items) {
      db.prepare("DELETE FROM assignment_template_items WHERE template_id = ?").run(id);
      input.items.forEach((item, order) => insertTemplateItem(id, item, order));
    }
  });
  run();
  return getTemplate(id);
}

export function deleteTemplate(id: string): void {
  getDb().prepare("DELETE FROM assignment_templates WHERE id = ?").run(id);
}

export function applyTemplate(templateId: string, studentId?: string | null): Assignment[] {
  const template = getTemplate(templateId);
  if (!template) throw new Error("template_not_found");
  const today = new Date();
  const created: Assignment[] = [];
  for (const item of template.items) {
    const dueAt = addDays(today, item.due_offset_days);
    created.push(
      createAssignment({
        studentId,
        subjectId: item.subject_id,
        type: item.type,
        title: item.title,
        description: item.description,
        targetId: item.target_id,
        dueAt,
        sortOrder: item.sort_order,
      })
    );
  }
  return created;
}

function practiceHref(type: "exercises" | "truefalse" | "typed", subjectId: string | null): string {
  const params = new URLSearchParams();
  params.set("tab", "practice");
  params.set("practiceTab", type === "truefalse" ? "truefalse" : type === "typed" ? "typed" : "exercises");
  if (subjectId) params.set("subject", subjectId);
  return `/activities?${params.toString()}`;
}

export function assignmentHref(assignment: Pick<Assignment, "type" | "subject_id" | "target_id">): string {
  if (assignment.type === "lesson" && assignment.target_id) return `/lessons/${assignment.target_id}`;
  if (assignment.type === "quiz" && assignment.subject_id) {
    return `/activities?tab=quizzes&subject=${assignment.subject_id}`;
  }
  if (assignment.type === "mock_exam") return "/activities?tab=mock";
  if (assignment.type === "material" && assignment.subject_id) return `/subjects/${assignment.subject_id}`;
  if (assignment.type === "flashcards")
    return assignment.subject_id ? `/flashcards?subject=${assignment.subject_id}` : "/flashcards";
  if (assignment.type === "exercises" || assignment.type === "truefalse" || assignment.type === "typed")
    return practiceHref(assignment.type, assignment.subject_id);
  if (assignment.subject_id) return `/subjects/${assignment.subject_id}`;
  return "/";
}
