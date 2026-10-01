import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { chatJSON } from "./llm";
import { getMaterial } from "./subjects";
import { classifyTopicsPrompt, type ClassifyResult } from "./prompts/classify";

export interface Topic {
  id: string;
  subject_id: string;
  name: string;
  created_at: string;
}

export function listTopics(subjectId: string): Topic[] {
  return getDb()
    .prepare("SELECT * FROM topics WHERE subject_id = ? ORDER BY created_at ASC, rowid ASC")
    .all(subjectId) as Topic[];
}

export function getTopic(id: string): Topic | null {
  const row = getDb().prepare("SELECT * FROM topics WHERE id = ?").get(id) as
    | Topic
    | undefined;
  return row ?? null;
}

export function createTopic(subjectId: string, name: string): Topic {
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO topics (id, subject_id, name) VALUES (?, ?, ?)")
    .run(id, subjectId, name.trim());
  return getTopic(id)!;
}

export function deleteTopic(id: string): void {
  getDb().prepare("DELETE FROM topics WHERE id = ?").run(id);
}

/** Resolve topic ids to their names, skipping unknown ids. */
export function topicNames(ids: string[]): string[] {
  const names: string[] = [];
  for (const id of ids) {
    const topic = getTopic(id);
    if (topic) names.push(topic.name);
  }
  return names;
}

/** Replace the set of topics a material is tagged with. */
export function setMaterialTopics(materialId: string, topicIds: string[]): void {
  const db = getDb();
  db.prepare("DELETE FROM material_topics WHERE material_id = ?").run(materialId);
  const ins = db.prepare(
    "INSERT OR IGNORE INTO material_topics (material_id, topic_id) VALUES (?, ?)"
  );
  for (const id of topicIds) ins.run(materialId, id);
}

/** Map of materialId -> topic names, for displaying tags on a list of materials. */
export function materialTopicNames(materialIds: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (materialIds.length === 0) return map;
  const placeholders = materialIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT mt.material_id AS material_id, t.name AS name
       FROM material_topics mt JOIN topics t ON t.id = mt.topic_id
       WHERE mt.material_id IN (${placeholders}) ORDER BY t.name`
    )
    .all(...materialIds) as { material_id: string; name: string }[];
  for (const r of rows) {
    const arr = map.get(r.material_id) ?? [];
    arr.push(r.name);
    map.set(r.material_id, arr);
  }
  return map;
}

/**
 * Best-effort: tag a material with the subject's topics its content covers,
 * using an LLM classification. No-ops when the subject has no topics or the
 * material has no text; never throws (a failure leaves the material untagged
 * rather than failing the upload).
 */
export async function classifyMaterialTopics(materialId: string): Promise<void> {
  const material = getMaterial(materialId);
  const text = material?.extracted_text?.trim();
  if (!material || !text) return;
  const topics = listTopics(material.subject_id);
  if (topics.length === 0) return;
  try {
    const result = await chatJSON<ClassifyResult>({
      messages: [
        {
          role: "user",
          content: classifyTopicsPrompt({
            topics: topics.map((t) => t.name),
            text: text.slice(0, 8000),
          }),
        },
      ],
      temperature: 0,
    });
    const idByName = new Map(topics.map((t) => [t.name.toLowerCase(), t.id]));
    const ids = (result.topics ?? [])
      .map((n) => idByName.get(n.trim().toLowerCase()))
      .filter((x): x is string => Boolean(x));
    setMaterialTopics(materialId, ids);
  } catch {
    /* best-effort: leave untagged on failure */
  }
}
