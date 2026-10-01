import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { chatJSON } from "./llm";
import { getMaterial } from "./subjects";
import { extractTopicsPrompt, type ExtractResult } from "./prompts/classify";

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
 * Reconcile a list of topic names against a subject's existing topics: reuse an
 * existing topic when the name matches (case-insensitive), otherwise create it.
 * Returns the resolved topic ids in order, deduped.
 */
export function resolveTopicIds(subjectId: string, names: string[]): string[] {
  const idByName = new Map(listTopics(subjectId).map((t) => [t.name.toLowerCase(), t.id]));
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    let id = idByName.get(key);
    if (!id) {
      id = createTopic(subjectId, name).id;
      idByName.set(key, id);
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Best-effort: derive the topics a material's content covers (creating any that
 * don't yet exist for the subject) and tag the material with them. No-ops when
 * the material has no text; never throws (a failure leaves the material
 * untagged rather than failing the upload).
 */
export async function autoTagMaterialTopics(materialId: string): Promise<void> {
  const material = getMaterial(materialId);
  const text = material?.extracted_text?.trim();
  if (!material || !text) return;
  const subjectId = material.subject_id;
  try {
    const existing = listTopics(subjectId).map((t) => t.name);
    const result = await chatJSON<ExtractResult>({
      messages: [
        {
          role: "user",
          content: extractTopicsPrompt({ text: text.slice(0, 8000), existingTopics: existing }),
        },
      ],
      temperature: 0,
    });
    const ids = resolveTopicIds(subjectId, (result.topics ?? []).slice(0, 5));
    if (ids.length > 0) setMaterialTopics(materialId, ids);
  } catch {
    /* best-effort: leave untagged on failure */
  }
}
