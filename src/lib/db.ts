import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./env";

let _db: Database.Database | null = null;

/** Default school subjects, seeded once on first run (any missing by name). */
const DEFAULT_SUBJECTS: { name: string; color: string }[] = [
  { name: "Informatika", color: "#0071e3" },
  { name: "Anglický jazyk", color: "#5856d6" },
  { name: "Fyzika", color: "#af52de" },
  { name: "Chemie", color: "#ff9500" },
  { name: "Český jazyk", color: "#ff3b30" },
  { name: "Matematika", color: "#00c7be" },
  { name: "Občanská výchova", color: "#ff2d55" },
  { name: "Biologie", color: "#34c759" },
  { name: "Dějepis", color: "#b08968" },
  { name: "Zeměpis", color: "#4dabf7" },
];

/**
 * Ordered, idempotent migrations. Append a new entry (version = last + 1)
 * when a later phase adds tables; never edit an applied migration.
 */
const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS subjects (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        color      TEXT NOT NULL DEFAULT '#0071e3',
        icon       TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS materials (
        id             TEXT PRIMARY KEY,
        subject_id     TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        filename       TEXT NOT NULL,
        stored_path    TEXT NOT NULL,
        mime           TEXT NOT NULL,
        kind           TEXT NOT NULL,
        size           INTEGER NOT NULL DEFAULT 0,
        extracted_text TEXT,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_materials_subject ON materials(subject_id);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id         TEXT PRIMARY KEY,
        subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
        title      TEXT NOT NULL DEFAULT 'New chat',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id         TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role       TEXT NOT NULL,
        content    TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS study_plans (
        id           TEXT PRIMARY KEY,
        subject_id   TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        title        TEXT NOT NULL,
        exam_date    TEXT NOT NULL,
        target_grade TEXT,
        status       TEXT NOT NULL DEFAULT 'active',
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS plan_items (
        id           TEXT PRIMARY KEY,
        plan_id      TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
        day_index    INTEGER NOT NULL,
        date         TEXT NOT NULL,
        topic        TEXT NOT NULL,
        instructions TEXT NOT NULL,
        done         INTEGER NOT NULL DEFAULT 0,
        sort_order   INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON plan_items(plan_id);
    `,
  },
  {
    version: 5,
    sql: `
      CREATE TABLE IF NOT EXISTS flashcards (
        id         TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        front      TEXT NOT NULL,
        back       TEXT NOT NULL,
        ease       REAL NOT NULL DEFAULT 2.5,
        interval   REAL NOT NULL DEFAULT 0,
        reps       INTEGER NOT NULL DEFAULT 0,
        due_at     TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_flashcards_subject ON flashcards(subject_id);

      CREATE TABLE IF NOT EXISTS quizzes (
        id         TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS questions (
        id            TEXT PRIMARY KEY,
        quiz_id       TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        prompt        TEXT NOT NULL,
        options       TEXT NOT NULL,
        correct_index INTEGER NOT NULL,
        explanation   TEXT NOT NULL DEFAULT '',
        sort_order    INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);

      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id       TEXT PRIMARY KEY,
        quiz_id  TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        score    INTEGER NOT NULL,
        total    INTEGER NOT NULL,
        answers  TEXT NOT NULL,
        taken_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 6,
    sql: `
      CREATE TABLE IF NOT EXISTS exercises (
        id             TEXT PRIMARY KEY,
        subject_id     TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        prompt         TEXT NOT NULL,
        solution_steps TEXT NOT NULL,
        difficulty     TEXT NOT NULL DEFAULT 'medium',
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_exercises_subject ON exercises(subject_id);

      CREATE TABLE IF NOT EXISTS truefalse (
        id          TEXT PRIMARY KEY,
        subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        statement   TEXT NOT NULL,
        is_correct  INTEGER NOT NULL,
        explanation TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_truefalse_subject ON truefalse(subject_id);
    `,
  },
  {
    version: 7,
    sql: `
      CREATE TABLE IF NOT EXISTS jobs (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL,
        payload     TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'pending',
        error       TEXT,
        result      TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        started_at  TEXT,
        finished_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

      ALTER TABLE materials ADD COLUMN status TEXT NOT NULL DEFAULT 'ready';
      ALTER TABLE materials ADD COLUMN error TEXT;
      ALTER TABLE materials ADD COLUMN job_id TEXT;

      ALTER TABLE quizzes ADD COLUMN duration_min INTEGER;
    `,
  },
  {
    version: 8,
    sql: `
      CREATE TABLE IF NOT EXISTS topics (
        id         TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_topics_subject ON topics(subject_id);

      ALTER TABLE questions ADD COLUMN diagram TEXT;
      ALTER TABLE exercises ADD COLUMN diagram TEXT;
    `,
  },
  {
    version: 9,
    sql: `
      ALTER TABLE materials ADD COLUMN role TEXT NOT NULL DEFAULT 'notes';
      ALTER TABLE materials ADD COLUMN parse_job_id TEXT;

      CREATE TABLE IF NOT EXISTS exam_questions (
        id          TEXT PRIMARY KEY,
        material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        prompt      TEXT NOT NULL,
        options     TEXT,
        answer      TEXT,
        explanation TEXT,
        diagram     TEXT,
        sort_order  INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_exam_questions_material ON exam_questions(material_id);
    `,
  },
  {
    version: 10,
    sql: `
      CREATE TABLE IF NOT EXISTS material_topics (
        material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        topic_id    TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        PRIMARY KEY (material_id, topic_id)
      );
      CREATE INDEX IF NOT EXISTS idx_material_topics_topic ON material_topics(topic_id);
    `,
  },
  {
    version: 11,
    sql: `
      CREATE TABLE IF NOT EXISTS unlocked_achievements (
        achievement_id TEXT PRIMARY KEY,
        unlocked_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    version: 12,
    sql: `
      ALTER TABLE flashcards ADD COLUMN stability REAL NOT NULL DEFAULT 0;
      ALTER TABLE flashcards ADD COLUMN difficulty REAL NOT NULL DEFAULT 0;
      ALTER TABLE flashcards ADD COLUMN state INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE flashcards ADD COLUMN lapses INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE flashcards ADD COLUMN last_review TEXT;

      -- Carry over SM-2 "learned" cards into FSRS Review state (stability ~ old interval).
      UPDATE flashcards SET state = 2, stability = interval, difficulty = 5 WHERE interval > 0;

      CREATE TABLE IF NOT EXISTS review_logs (
        id             TEXT PRIMARY KEY,
        card_id        TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
        reviewed_at    TEXT NOT NULL,
        rating         INTEGER NOT NULL,
        state          INTEGER NOT NULL,
        stability      REAL NOT NULL,
        difficulty     REAL NOT NULL,
        scheduled_days REAL NOT NULL,
        retention      REAL
      );
      CREATE INDEX IF NOT EXISTS idx_review_logs_card ON review_logs(card_id);
      CREATE INDEX IF NOT EXISTS idx_review_logs_reviewed ON review_logs(reviewed_at);
    `,
  },
  {
    version: 13,
    sql: `
      ALTER TABLE chat_sessions ADD COLUMN updated_at TEXT;
      UPDATE chat_sessions SET updated_at = created_at WHERE updated_at IS NULL;
    `,
  },
  {
    version: 14,
    sql: `
      CREATE TABLE IF NOT EXISTS lessons (
        id         TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        topic_ids  TEXT NOT NULL DEFAULT '[]',
        status     TEXT NOT NULL DEFAULT 'processing',
        error      TEXT,
        job_id     TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_lessons_subject ON lessons(subject_id);

      CREATE TABLE IF NOT EXISTS lesson_chapters (
        id         TEXT PRIMARY KEY,
        lesson_id  TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        summary    TEXT NOT NULL DEFAULT '',
        body       TEXT NOT NULL DEFAULT '',
        diagram    TEXT,
        check_json TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_lesson_chapters_lesson ON lesson_chapters(lesson_id);
    `,
  },
  {
    version: 15,
    sql: `
      ALTER TABLE lesson_chapters ADD COLUMN figure_ids TEXT NOT NULL DEFAULT '[]';
    `,
  },
  {
    version: 16,
    sql: `
      CREATE TABLE IF NOT EXISTS board_columns (
        id         TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_board_columns_subject ON board_columns(subject_id);

      CREATE TABLE IF NOT EXISTS board_cards (
        id         TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        column_id  TEXT NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
        title      TEXT NOT NULL,
        note       TEXT NOT NULL DEFAULT '',
        kind       TEXT NOT NULL DEFAULT 'task',
        lesson_id  TEXT REFERENCES lessons(id) ON DELETE SET NULL,
        chapter_id TEXT REFERENCES lesson_chapters(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_board_cards_subject ON board_cards(subject_id);
      CREATE INDEX IF NOT EXISTS idx_board_cards_column ON board_cards(column_id);
    `,
  },
  {
    version: 17,
    sql: `
      ALTER TABLE board_cards ADD COLUMN material_id TEXT REFERENCES materials(id) ON DELETE CASCADE;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_board_cards_material_unique
        ON board_cards(material_id)
        WHERE material_id IS NOT NULL;
    `,
  },
  {
    version: 18,
    sql: `
      CREATE TABLE IF NOT EXISTS typed_exercises (
        id               TEXT PRIMARY KEY,
        subject_id       TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        prompt           TEXT NOT NULL,
        expected_answer  TEXT NOT NULL,
        accepted_answers TEXT NOT NULL DEFAULT '[]',
        grading_mode     TEXT NOT NULL DEFAULT 'flexible',
        explanation      TEXT NOT NULL DEFAULT '',
        difficulty       TEXT NOT NULL DEFAULT 'medium',
        created_at       TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_typed_exercises_subject ON typed_exercises(subject_id);

      CREATE TABLE IF NOT EXISTS typed_attempts (
        id           TEXT PRIMARY KEY,
        exercise_id  TEXT NOT NULL REFERENCES typed_exercises(id) ON DELETE CASCADE,
        answer       TEXT NOT NULL,
        correct      INTEGER NOT NULL,
        score        INTEGER NOT NULL DEFAULT 0,
        feedback     TEXT NOT NULL DEFAULT '',
        grading_mode TEXT NOT NULL,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_typed_attempts_exercise ON typed_attempts(exercise_id);
    `,
  },
  {
    version: 19,
    sql: `
      CREATE TABLE IF NOT EXISTS students (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS assignments (
        id           TEXT PRIMARY KEY,
        student_id   TEXT REFERENCES students(id) ON DELETE CASCADE,
        subject_id   TEXT REFERENCES subjects(id) ON DELETE SET NULL,
        type         TEXT NOT NULL DEFAULT 'custom',
        title        TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        target_id    TEXT,
        due_at       TEXT,
        status       TEXT NOT NULL DEFAULT 'todo',
        sort_order   INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_assignments_student ON assignments(student_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);

      CREATE TABLE IF NOT EXISTS assignment_templates (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS assignment_template_items (
        id              TEXT PRIMARY KEY,
        template_id     TEXT NOT NULL REFERENCES assignment_templates(id) ON DELETE CASCADE,
        type            TEXT NOT NULL DEFAULT 'custom',
        title           TEXT NOT NULL,
        description     TEXT NOT NULL DEFAULT '',
        subject_id      TEXT REFERENCES subjects(id) ON DELETE SET NULL,
        target_id       TEXT,
        due_offset_days INTEGER NOT NULL DEFAULT 0,
        sort_order      INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_assignment_template_items_template
        ON assignment_template_items(template_id);
    `,
  },
  {
    version: 20,
    sql: `
      CREATE TABLE IF NOT EXISTS upload_sessions (
        id              TEXT PRIMARY KEY,
        subject_id      TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        filename        TEXT NOT NULL,
        mime            TEXT NOT NULL,
        size            INTEGER NOT NULL,
        role            TEXT NOT NULL DEFAULT 'notes',
        container_name  TEXT NOT NULL DEFAULT '',
        temp_path       TEXT NOT NULL,
        total_chunks    INTEGER NOT NULL,
        received_chunks INTEGER NOT NULL DEFAULT 0,
        received_bytes  INTEGER NOT NULL DEFAULT 0,
        status          TEXT NOT NULL DEFAULT 'uploading',
        error           TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_upload_sessions_subject ON upload_sessions(subject_id);
      CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(status);
    `,
  },
  {
    version: 21,
    sql: `
      ALTER TABLE materials ADD COLUMN extracted_text_path TEXT;
      ALTER TABLE materials ADD COLUMN extracted_text_length INTEGER NOT NULL DEFAULT 0;
      UPDATE materials SET extracted_text_length = COALESCE(length(extracted_text), 0);
    `,
  },
  {
    version: 22,
    sql: `
      ALTER TABLE materials ADD COLUMN page_count INTEGER;

      CREATE TABLE IF NOT EXISTS material_pages (
        id          TEXT PRIMARY KEY,
        material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        page_number INTEGER NOT NULL,
        image_path  TEXT,
        text        TEXT,
        status      TEXT NOT NULL DEFAULT 'pending',
        error       TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (material_id, page_number)
      );
      CREATE INDEX IF NOT EXISTS idx_material_pages_material
        ON material_pages(material_id, page_number);
    `,
  },
  {
    version: 23,
    sql: `
      ALTER TABLE material_pages ADD COLUMN topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS material_toc_entries (
        id             TEXT PRIMARY KEY,
        material_id    TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        topic_id       TEXT REFERENCES topics(id) ON DELETE SET NULL,
        title          TEXT NOT NULL,
        level          INTEGER NOT NULL DEFAULT 1,
        printed_page   INTEGER NOT NULL,
        pdf_page_start INTEGER NOT NULL,
        pdf_page_end   INTEGER,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_material_toc_entries_material
        ON material_toc_entries(material_id, pdf_page_start);
      CREATE INDEX IF NOT EXISTS idx_material_toc_entries_topic
        ON material_toc_entries(topic_id);
    `,
  },
  {
    version: 24,
    sql: `
      ALTER TABLE quizzes ADD COLUMN archived_at TEXT;
      ALTER TABLE quizzes ADD COLUMN source_refs TEXT;

      ALTER TABLE exercises ADD COLUMN archived_at TEXT;
      ALTER TABLE exercises ADD COLUMN source_refs TEXT;

      ALTER TABLE truefalse ADD COLUMN archived_at TEXT;
      ALTER TABLE truefalse ADD COLUMN source_refs TEXT;

      ALTER TABLE typed_exercises ADD COLUMN archived_at TEXT;
      ALTER TABLE typed_exercises ADD COLUMN source_refs TEXT;

      ALTER TABLE lessons ADD COLUMN source_refs TEXT;

      CREATE INDEX IF NOT EXISTS idx_quizzes_subject_created ON quizzes(subject_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_quizzes_archived_created ON quizzes(archived_at, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_exercises_subject_created ON exercises(subject_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_exercises_archived_created ON exercises(archived_at, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_truefalse_subject_created ON truefalse(subject_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_truefalse_archived_created ON truefalse(archived_at, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_typed_exercises_subject_created ON typed_exercises(subject_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_typed_exercises_archived_created ON typed_exercises(archived_at, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_flashcards_subject_due ON flashcards(subject_id, due_at ASC);
      CREATE INDEX IF NOT EXISTS idx_material_pages_topic ON material_pages(topic_id);
    `,
  },
  {
    version: 25,
    sql: `
      CREATE TABLE IF NOT EXISTS activity_attempts (
        id          TEXT PRIMARY KEY,
        subject_id  TEXT REFERENCES subjects(id) ON DELETE CASCADE,
        kind        TEXT NOT NULL,
        item_id     TEXT NOT NULL,
        question_id TEXT,
        correct     INTEGER,
        score       INTEGER,
        payload     TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_activity_attempts_subject_created
        ON activity_attempts(subject_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_attempts_kind_created
        ON activity_attempts(kind, created_at DESC);

      INSERT INTO activity_attempts (id, subject_id, kind, item_id, question_id, correct, score, payload, created_at)
      SELECT lower(hex(randomblob(16))), q.subject_id, 'quiz', qa.quiz_id, NULL,
             CASE WHEN qa.score = qa.total THEN 1 ELSE 0 END,
             CASE WHEN qa.total > 0 THEN CAST(ROUND(100.0 * qa.score / qa.total) AS INTEGER) ELSE NULL END,
             json_object('score', qa.score, 'total', qa.total),
             qa.taken_at
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id;

      INSERT INTO activity_attempts (id, subject_id, kind, item_id, question_id, correct, score, payload, created_at)
      SELECT lower(hex(randomblob(16))), e.subject_id, 'typed', ta.exercise_id, NULL,
             ta.correct, ta.score,
             json_object('answer', ta.answer, 'feedback', ta.feedback, 'grading_mode', ta.grading_mode),
             ta.created_at
      FROM typed_attempts ta
      JOIN typed_exercises e ON e.id = ta.exercise_id;
    `,
  },
  {
    version: 26,
    sql: `
      ALTER TABLE quizzes ADD COLUMN topic_ids TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE quizzes ADD COLUMN column_ids TEXT NOT NULL DEFAULT '[]';

      ALTER TABLE exercises ADD COLUMN topic_ids TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE exercises ADD COLUMN column_ids TEXT NOT NULL DEFAULT '[]';

      ALTER TABLE truefalse ADD COLUMN topic_ids TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE truefalse ADD COLUMN column_ids TEXT NOT NULL DEFAULT '[]';

      ALTER TABLE typed_exercises ADD COLUMN topic_ids TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE typed_exercises ADD COLUMN column_ids TEXT NOT NULL DEFAULT '[]';

      CREATE INDEX IF NOT EXISTS idx_activity_attempts_item ON activity_attempts(kind, item_id);
    `,
  },
];

export function getDb(): Database.Database {
  if (_db) return _db;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "study.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  _db = db;
  return db;
}

/** One-time: add any default subjects not already present (matched by name). */
function seed(db: Database.Database): void {
  if (process.env.NODE_ENV === "test") return;
  const done = (
    db.prepare("SELECT value FROM settings WHERE key = 'seeded'").get() as
      | { value: string }
      | undefined
  )?.value;
  if (done) return;
  // Match by name ignoring case and diacritics (so "dejepis" == "Dějepis").
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const existing = new Set(
    (db.prepare("SELECT name FROM subjects").all() as { name: string }[]).map((r) => norm(r.name))
  );
  const insert = db.prepare("INSERT INTO subjects (id, name, color, icon) VALUES (?, ?, ?, NULL)");
  for (const s of DEFAULT_SUBJECTS) {
    if (!existing.has(norm(s.name))) insert.run(randomUUID(), s.name, s.color);
  }
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('seeded', '1') ON CONFLICT(key) DO UPDATE SET value = '1'"
  ).run();
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const applied = new Set<number>(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map(
      (r) => r.version
    )
  );
  const insert = db.prepare("INSERT INTO schema_migrations (version) VALUES (?)");
  for (const m of MIGRATIONS) {
    if (!applied.has(m.version)) {
      db.exec(m.sql);
      insert.run(m.version);
    }
  }
}

export function getSetting(key: string): string | null {
  try {
    const row = getDb()
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}
