import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR || "./data";
const dbPath = path.join(dataDir, "study.db");

if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${dbPath}. Start the app once first, then run this script.`);
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function tableExists(name) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

if (!tableExists("subjects") || !tableExists("board_columns")) {
  console.error("Database is not migrated yet. Start the app once first, then run this script.");
  process.exit(1);
}

function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

function ensureSubject(name, color) {
  const row = db.prepare("SELECT id FROM subjects WHERE lower(name) = lower(?)").get(name);
  if (row) return row.id;
  const id = randomUUID();
  db.prepare("INSERT INTO subjects (id, name, color) VALUES (?, ?, ?)").run(id, name, color);
  return id;
}

function ensureTopic(subjectId, name) {
  const row = db
    .prepare("SELECT id FROM topics WHERE subject_id = ? AND lower(name) = lower(?)")
    .get(subjectId, name);
  if (row) return row.id;
  const id = randomUUID();
  db.prepare("INSERT INTO topics (id, subject_id, name) VALUES (?, ?, ?)").run(id, subjectId, name);
  return id;
}

function ensureTextMaterial(subjectId, filename, text) {
  const row = db
    .prepare("SELECT id FROM materials WHERE subject_id = ? AND filename = ?")
    .get(subjectId, filename);
  if (row) return row.id;
  const id = randomUUID();
  const dir = path.join(dataDir, "uploads", subjectId);
  fs.mkdirSync(dir, { recursive: true });
  const storedPath = path.join(dir, `${id}.txt`);
  fs.writeFileSync(storedPath, text);
  db.prepare(
    `INSERT INTO materials
      (id, subject_id, filename, stored_path, mime, kind, size, extracted_text, status, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', 'notes')`
  ).run(id, subjectId, filename, storedPath, "text/plain", "text", Buffer.byteLength(text), text);
  return id;
}

function ensureImageMaterial(subjectId, filename, svg) {
  const row = db
    .prepare("SELECT id FROM materials WHERE subject_id = ? AND filename = ?")
    .get(subjectId, filename);
  if (row) return row.id;
  const id = randomUUID();
  const dir = path.join(dataDir, "uploads", subjectId);
  fs.mkdirSync(dir, { recursive: true });
  const storedPath = path.join(dir, `${id}.svg`);
  fs.writeFileSync(storedPath, svg);
  db.prepare(
    `INSERT INTO materials
      (id, subject_id, filename, stored_path, mime, kind, size, extracted_text, status, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', 'notes')`
  ).run(
    id,
    subjectId,
    filename,
    storedPath,
    "image/svg+xml",
    "image",
    Buffer.byteLength(svg),
    "Diagram: pravoúhlý trojúhelník s přeponou c."
  );
  return id;
}

function ensureLesson(subjectId, title, topicIds) {
  const row = db
    .prepare("SELECT id FROM lessons WHERE subject_id = ? AND title = ?")
    .get(subjectId, title);
  if (row) return row.id;
  const id = randomUUID();
  db.prepare(
    "INSERT INTO lessons (id, subject_id, title, topic_ids, status) VALUES (?, ?, ?, ?, 'ready')"
  ).run(id, subjectId, title, JSON.stringify(topicIds));
  return id;
}

function ensureChapter(lessonId, title, summary, body, diagram, check, figureIds, sortOrder) {
  const row = db.prepare("SELECT id FROM lesson_chapters WHERE lesson_id = ? AND title = ?").get(lessonId, title);
  if (row) return row.id;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO lesson_chapters
      (id, lesson_id, title, summary, body, diagram, check_json, figure_ids, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    lessonId,
    title,
    summary,
    body,
    diagram,
    JSON.stringify(check),
    JSON.stringify(figureIds),
    sortOrder
  );
  return id;
}

function ensureColumn(subjectId, name) {
  const row = db
    .prepare("SELECT id FROM board_columns WHERE subject_id = ? AND lower(name) = lower(?)")
    .get(subjectId, name);
  if (row) return row.id;
  const id = randomUUID();
  const sort =
    (db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS n FROM board_columns WHERE subject_id = ?").get(subjectId)
      .n ?? -1) + 1;
  db.prepare("INSERT INTO board_columns (id, subject_id, name, sort_order) VALUES (?, ?, ?, ?)").run(
    id,
    subjectId,
    name,
    sort
  );
  return id;
}

function ensureMaterialCard(columnId, materialId) {
  const row = db.prepare("SELECT id FROM board_cards WHERE material_id = ?").get(materialId);
  if (row) return row.id;
  const column = db.prepare("SELECT subject_id FROM board_columns WHERE id = ?").get(columnId);
  const material = db.prepare("SELECT filename FROM materials WHERE id = ?").get(materialId);
  const id = randomUUID();
  const sort =
    (db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS n FROM board_cards WHERE column_id = ?").get(columnId)
      .n ?? -1) + 1;
  db.prepare(
    `INSERT INTO board_cards
      (id, subject_id, column_id, title, kind, material_id, sort_order)
     VALUES (?, ?, ?, ?, 'material', ?, ?)`
  ).run(id, column.subject_id, columnId, material.filename, materialId, sort);
  return id;
}

function ensureFlashcard(subjectId, front, back) {
  const row = db
    .prepare("SELECT id FROM flashcards WHERE subject_id = ? AND front = ?")
    .get(subjectId, front);
  if (row) return row.id;
  const id = randomUUID();
  db.prepare(
    "INSERT INTO flashcards (id, subject_id, front, back, due_at) VALUES (?, ?, ?, ?, datetime('now'))"
  ).run(id, subjectId, front, back);
  return id;
}

function ensureQuiz(subjectId, title, questions) {
  const row = db.prepare("SELECT id FROM quizzes WHERE subject_id = ? AND title = ?").get(subjectId, title);
  if (row) return row.id;
  const id = randomUUID();
  db.prepare("INSERT INTO quizzes (id, subject_id, title) VALUES (?, ?, ?)").run(id, subjectId, title);
  const insert = db.prepare(
    "INSERT INTO questions (id, quiz_id, prompt, options, correct_index, explanation, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  questions.forEach((q, i) => {
    insert.run(randomUUID(), id, q.prompt, JSON.stringify(q.options), q.correctIndex, q.explanation, i);
  });
  return id;
}

setSetting("theme", "light");
setSetting("name", "Honza");

const mathId = ensureSubject("Matematika", "#00c7be");

const pythagorasTopic = ensureTopic(mathId, "Pythagorova věta");
const equationsTopic = ensureTopic(mathId, "Lineární rovnice");
const areasTopic = ensureTopic(mathId, "Obsahy útvarů");

const notes = `Matematika – ukázkové poznámky

Pythagorova věta: a² + b² = c². Přepona je nejdelší strana pravoúhlého trojúhelníku.
Příklad: odvěsny 3 a 4, přepona c = √(3² + 4²) = 5.

Lineární rovnice: 3x + 5 = 20, x = 5.

Obsah obdélníka: S = a · b.`;

const notesMaterial = ensureTextMaterial(mathId, "matematika-poznamky.txt", notes);
const diagramMaterial = ensureImageMaterial(
  mathId,
  "pythagorova-veta.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240" role="img" aria-label="Pravoúhlý trojúhelník">
  <rect width="360" height="240" fill="#f5f5f7"/>
  <polygon points="60,190 280,190 60,60" fill="rgba(0,113,227,0.12)" stroke="#0071e3" stroke-width="4"/>
  <rect x="60" y="160" width="30" height="30" fill="none" stroke="#6e6e73" stroke-width="2"/>
  <text x="160" y="215" font-family="sans-serif" font-size="20" fill="#1d1d1f">a = 3</text>
  <text x="20" y="130" font-family="sans-serif" font-size="20" fill="#1d1d1f">b = 4</text>
  <text x="185" y="110" font-family="sans-serif" font-size="20" fill="#1d1d1f">c = 5</text>
</svg>`
);

const scanMaterial = ensureImageMaterial(
  mathId,
  "naskenovany-list.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240" role="img" aria-label="Sken poznámek">
  <rect width="360" height="240" fill="#ffffff"/>
  <rect x="30" y="30" width="300" height="180" fill="#f5f5f7" stroke="#d2d2d7" stroke-width="3"/>
  <text x="55" y="75" font-family="sans-serif" font-size="22" fill="#1d1d1f">3x + 5 = 20</text>
  <text x="55" y="115" font-family="sans-serif" font-size="22" fill="#1d1d1f">3x = 15</text>
  <text x="55" y="155" font-family="sans-serif" font-size="22" fill="#1d1d1f">x = 5</text>
</svg>`
);

db.prepare("INSERT OR IGNORE INTO material_topics (material_id, topic_id) VALUES (?, ?)").run(
  notesMaterial,
  pythagorasTopic
);
db.prepare("INSERT OR IGNORE INTO material_topics (material_id, topic_id) VALUES (?, ?)").run(
  notesMaterial,
  equationsTopic
);
db.prepare("INSERT OR IGNORE INTO material_topics (material_id, topic_id) VALUES (?, ?)").run(
  notesMaterial,
  areasTopic
);

const lessonId = ensureLesson(mathId, "Pythagorova věta od nuly", [pythagorasTopic]);
ensureChapter(
  lessonId,
  "Co je pravoúhlý trojúhelník",
  "Strany a pravý úhel.",
  `Pravoúhlý trojúhelník má jeden úhel **90°**. Nejdelší strana, která leží naproti pravému úhlu, se jmenuje **přepona**. Zbývající dvě strany jsou **odvěsny**.

Základní vztah je:

$$a^2 + b^2 = c^2$$`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 180" role="img" aria-label="Pravoúhlý trojúhelník"><polygon points="40,140 210,140 40,40" fill="rgba(0,199,190,0.12)" stroke="#00c7be" stroke-width="4"/><text x="110" y="165" font-family="sans-serif" font-size="18" fill="#1d1d1f">a</text><text x="15" y="95" font-family="sans-serif" font-size="18" fill="#1d1d1f">b</text><text x="135" y="80" font-family="sans-serif" font-size="18" fill="#1d1d1f">c</text></svg>`,
  {
    question: "Která strana je přepona?",
    options: ["Nejdelší strana", "Nejkratší strana", "Strana přilehlá k pravému úhlu"],
    answerIndex: 0,
    explanation: "Přepona leží naproti pravému úhlu a je nejdelší.",
  },
  [diagramMaterial],
  0
);
ensureChapter(
  lessonId,
  "Výpočet přepony",
  "Dosadíme do vzorce.",
  `Mějme odvěsny $a = 3$ a $b = 4$.

$$c = \\sqrt{a^2 + b^2} = \\sqrt{3^2 + 4^2} = \\sqrt{9 + 16} = \\sqrt{25} = 5$$`,
  null,
  {
    question: "Jaká je přepona pro odvěsny 3 a 4?",
    options: ["5", "7", "12"],
    answerIndex: 0,
    explanation: "√(9 + 16) = √25 = 5.",
  },
  [diagramMaterial],
  1
);
ensureChapter(
  lessonId,
  "Příklady z praxe",
  "Kde se Pythagorova věta používá.",
  `Použití: výška žebříku, úhlopříčka obrazovky, vzdálenost dvou míst na mapě.

Tip: vždy si nejprve zakresli pravý úhel a pojmenuj strany.`,
  null,
  {
    question: "Co musíš udělat jako první?",
    options: ["Zakreslit pravý úhel", "Vynásobit strany", "Odčíst strany"],
    answerIndex: 0,
    explanation: "Bez pravého úhlu nelze Pythagorovu větu použít.",
  },
  [],
  2
);

const doneLessonId = ensureLesson(mathId, "Obsah obdélníka", [areasTopic]);
ensureChapter(
  doneLessonId,
  "Obsah obdélníka",
  "Základní vzorec.",
  `Obsah obdélníka je $S = a \\cdot b$.`,
  null,
  {
    question: "Jaký je obsah obdélníka 4 × 5?",
    options: ["20", "9", "45"],
    answerIndex: 0,
    explanation: "4 · 5 = 20.",
  },
  [],
  0
);

const notesCol = ensureColumn(mathId, "Poznámky");
const photosCol = ensureColumn(mathId, "Fotky z tabule");
const todoCol = ensureColumn(mathId, "Ke zpracování");

ensureMaterialCard(notesCol, notesMaterial);
ensureMaterialCard(photosCol, diagramMaterial);
ensureMaterialCard(todoCol, scanMaterial);

ensureFlashcard(mathId, "Pythagorova věta", "a² + b² = c²");
ensureFlashcard(mathId, "Přepona", "nejdelší strana pravoúhlého trojúhelníku");
ensureFlashcard(mathId, "Obsah obdélníka", "S = a · b");

ensureQuiz(mathId, "Matematika: Pythagorova věta", [
  {
    prompt: "Jak zní Pythagorova věta?",
    options: ["a² + b² = c²", "a + b = c", "a · b = c²"],
    correctIndex: 0,
    explanation: "Součet čtverců odvěsen se rovná čtverci přepony.",
  },
  {
    prompt: "Přepona je:",
    options: ["nejdelší strana", "nejkratší strana", "strana vedle pravého úhlu"],
    correctIndex: 0,
    explanation: "Přepona leží naproti pravému úhlu.",
  },
  {
    prompt: "Trojúhelník s odvěsnami 3 a 4 má přeponu:",
    options: ["5", "6", "7"],
    correctIndex: 0,
    explanation: "√(3² + 4²) = 5.",
  },
]);

console.log("Demo content seeded.");
console.log(`Subject: Matematika (${mathId})`);
console.log(`Lesson:  ${lessonId}`);
db.close();