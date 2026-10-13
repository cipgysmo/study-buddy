#!/usr/bin/env node
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SOURCE = process.env.IMPORT_SOURCE_URL || "http://192.168.1.10:3000";
const dataDir = process.env.DATA_DIR || "./data";
const dbPath = path.join(dataDir, "study.db");
const dryRun = process.argv.includes("--dry-run");

if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${dbPath}. Start the local app once first, then run this script.`);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function tableExists(name) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

for (const table of ["subjects", "topics", "materials", "quizzes", "questions", "exercises", "truefalse", "typed_exercises", "lessons", "lesson_chapters"]) {
  if (!tableExists(table)) {
    console.error(`Database is missing table ${table}. Start the local app once first.`);
    process.exit(1);
  }
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

function insertIfMissing(table, columns, values) {
  if (columns.length !== values.length) {
    throw new Error(`Column/value mismatch for ${table}: ${columns.length} vs ${values.length}`);
  }
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
  const info = db.prepare(sql).run(...values);
  return info.changes > 0;
}

let counts = {
  subjects: 0,
  topics: 0,
  quizzes: 0,
  questions: 0,
  exercises: 0,
  truefalse: 0,
  typed: 0,
  lessons: 0,
  chapters: 0,
};

const subjects = (await getJson(`${SOURCE}/api/subjects`)).subjects ?? [];
for (const s of subjects) {
  if (insertIfMissing("subjects", ["id", "name", "color", "icon", "created_at"], [s.id, s.name, s.color, s.icon ?? null, s.created_at])) counts.subjects++;
}

for (const s of subjects) {
  const topics = (await getJson(`${SOURCE}/api/subjects/${s.id}/topics`)).topics ?? [];
  for (const t of topics) {
    if (insertIfMissing("topics", ["id", "subject_id", "name", "created_at"], [t.id, t.subject_id ?? s.id, t.name, t.created_at])) counts.topics++;
  }
}

const quizzes = (await getJson(`${SOURCE}/api/quizzes`)).quizzes ?? [];
for (const q of quizzes) {
  if (insertIfMissing("quizzes", ["id", "subject_id", "title", "created_at", "duration_min"], [q.id, q.subject_id, q.title, q.created_at, q.duration_min ?? null])) counts.quizzes++;
  const detail = await getJson(`${SOURCE}/api/quizzes/${q.id}`);
  for (const question of detail.questions ?? []) {
    if (
      insertIfMissing(
        "questions",
        ["id", "quiz_id", "prompt", "options", "correct_index", "explanation", "sort_order", "diagram"],
        [
          question.id ?? randomUUID(),
          q.id,
          question.prompt,
          typeof question.options === "string" ? question.options : JSON.stringify(question.options ?? []),
          question.correct_index ?? 0,
          question.explanation ?? "",
          question.sort_order ?? 0,
          question.diagram ?? null,
        ]
      )
    ) {
      counts.questions++;
    }
  }
}

for (const s of subjects) {
  const exercises = (await getJson(`${SOURCE}/api/exercises?subject=${encodeURIComponent(s.id)}`)).exercises ?? [];
  for (const e of exercises) {
    if (
      insertIfMissing(
        "exercises",
        ["id", "subject_id", "prompt", "solution_steps", "difficulty", "created_at", "diagram"],
        [
          e.id,
          e.subject_id,
          e.prompt,
          typeof e.solution_steps === "string" ? e.solution_steps : JSON.stringify(e.solution_steps ?? []),
          e.difficulty ?? "balanced",
          e.created_at,
          e.diagram ?? null,
        ]
      )
    ) {
      counts.exercises++;
    }
  }

  const trueFalse = (await getJson(`${SOURCE}/api/truefalse?subject=${encodeURIComponent(s.id)}`)).items ?? [];
  for (const item of trueFalse) {
    if (
      insertIfMissing(
        "truefalse",
        ["id", "subject_id", "statement", "is_correct", "explanation", "created_at"],
        [item.id, item.subject_id, item.statement, item.is_correct ? 1 : 0, item.explanation ?? "", item.created_at]
      )
    ) {
      counts.truefalse++;
    }
  }

  const typed = (await getJson(`${SOURCE}/api/typedexercises?subject=${encodeURIComponent(s.id)}`)).typedExercises ?? [];
  for (const e of typed) {
    if (
      insertIfMissing(
        "typed_exercises",
        [
          "id",
          "subject_id",
          "prompt",
          "expected_answer",
          "accepted_answers",
          "grading_mode",
          "explanation",
          "difficulty",
          "created_at",
        ],
        [
          e.id,
          e.subject_id,
          e.prompt,
          e.expected_answer,
          typeof e.accepted_answers === "string" ? e.accepted_answers : JSON.stringify(e.accepted_answers ?? []),
          e.grading_mode ?? "flexible",
          e.explanation ?? "",
          e.difficulty ?? "balanced",
          e.created_at,
        ]
      )
    ) {
      counts.typed++;
    }
  }
}

const lessons = (await getJson(`${SOURCE}/api/lessons`)).lessons ?? [];
for (const lesson of lessons) {
  if (
    insertIfMissing(
      "lessons",
      ["id", "subject_id", "title", "topic_ids", "status", "error", "job_id", "created_at"],
      [
        lesson.id,
        lesson.subject_id,
        lesson.title,
        typeof lesson.topic_ids === "string" ? lesson.topic_ids : JSON.stringify(lesson.topic_ids ?? []),
        lesson.status ?? "ready",
        lesson.error ?? null,
        lesson.job_id ?? null,
        lesson.created_at,
      ]
    )
  ) {
    counts.lessons++;
  }
  const detail = await getJson(`${SOURCE}/api/lessons/${lesson.id}`);
  for (const chapter of detail.chapters ?? []) {
    if (
      insertIfMissing(
        "lesson_chapters",
        ["id", "lesson_id", "title", "summary", "body", "diagram", "check_json", "figure_ids", "sort_order"],
        [
          chapter.id ?? randomUUID(),
          lesson.id,
          chapter.title,
          chapter.summary ?? "",
          chapter.body ?? "",
          chapter.diagram ?? null,
          typeof chapter.check === "string" ? chapter.check : JSON.stringify(chapter.check ?? null),
          typeof chapter.figureIds === "string" ? chapter.figureIds : JSON.stringify(chapter.figureIds ?? []),
          chapter.sort_order ?? 0,
        ]
      )
    ) {
      counts.chapters++;
    }
  }
}

if (dryRun) {
  console.log("Dry run complete. No rows were written.");
}

console.log(`Imported from ${SOURCE}`);
console.table(counts);
