import { randomUUID } from "node:crypto";
import { getDb } from "./db";

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
