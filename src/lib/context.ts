import { getDb } from "./db";
import { listMaterials } from "./subjects";

/**
 * Concatenate a subject's extracted material text into a single context block,
 * truncated to a character budget so it fits the model's context window.
 *
 * When `topicIds` is provided (non-empty), only materials tagged with at least
 * one of those topics are included; if none are tagged it falls back to the
 * whole subject so generation never runs on an empty context.
 */
export function buildSubjectContext(subjectId: string, topicIds?: string[], maxChars = 60000): string {
  let materials = listMaterials(subjectId);
  if (topicIds && topicIds.length > 0) {
    const placeholders = topicIds.map(() => "?").join(",");
    const rows = getDb()
      .prepare(`SELECT DISTINCT material_id FROM material_topics WHERE topic_id IN (${placeholders})`)
      .all(...topicIds) as { material_id: string }[];
    const tagged = new Set(rows.map((r) => r.material_id));
    const filtered = materials.filter((m) => tagged.has(m.id));
    if (filtered.length > 0) materials = filtered;
  }
  const parts: string[] = [];
  let total = 0;
  for (const m of materials) {
    if (!m.extracted_text) continue;
    if (total >= maxChars) break;
    const header = `### ${m.filename}\n`;
    const room = maxChars - total;
    const text = m.extracted_text.length > room ? m.extracted_text.slice(0, room) : m.extracted_text;
    parts.push(header + text);
    total += header.length + text.length;
  }
  return parts.join("\n\n");
}
