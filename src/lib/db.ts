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
