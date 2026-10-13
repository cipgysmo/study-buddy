import { listMaterialIdsInColumns } from "./board";
import { getDb } from "./db";
import { getMaterialText, listMaterials } from "./subjects";

export interface SubjectContextOptions {
  columnIds?: string[];
  keywords?: string[];
}

/**
 * Concatenate a subject's extracted material text into a single context block,
 * truncated to a character budget so it fits the model's context window.
 *
 * Topic filters fall back to the current material pool when they match nothing.
 * Container filters are strict: selecting a container should not silently pull
 * in materials from outside it.
 */
export function buildSubjectContext(
  subjectId: string,
  topicIds?: string[],
  maxChars = 60000,
  opts: SubjectContextOptions = {}
): string {
  let materials = listMaterials(subjectId);

  if (opts.columnIds && opts.columnIds.length > 0) {
    const inColumn = new Set(listMaterialIdsInColumns(opts.columnIds));
    materials = materials.filter((m) => inColumn.has(m.id));
  }

  if (topicIds && topicIds.length > 0) {
    const placeholders = topicIds.map(() => "?").join(",");
    const rows = getDb()
      .prepare(`SELECT DISTINCT material_id FROM material_topics WHERE topic_id IN (${placeholders})`)
      .all(...topicIds) as { material_id: string }[];
    const tagged = new Set(rows.map((r) => r.material_id));
    const filtered = materials.filter((m) => tagged.has(m.id));
    if (filtered.length > 0) {
      materials = filtered;
    } else if (!opts.columnIds || opts.columnIds.length === 0) {
      materials = listMaterials(subjectId);
    }
  }

  if (opts.keywords && opts.keywords.length > 0) {
    const keywords = opts.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (keywords.length > 0) {
      const filtered = materials.filter((m) => {
        const haystack = `${m.filename}\n${getMaterialText(m.id) ?? ""}`.toLowerCase();
        return keywords.some((keyword) => haystack.includes(keyword));
      });
      if (filtered.length > 0) materials = filtered;
    }
  }

  const parts: string[] = [];
  let total = 0;
  for (const m of materials) {
    if (m.extracted_text_length <= 0) continue;
    if (total >= maxChars) break;
    const text = getMaterialText(m.id);
    if (!text) continue;
    const header = `### ${m.filename}\n`;
    const room = maxChars - total;
    const clipped = text.length > room ? text.slice(0, room) : text;
    parts.push(header + clipped);
    total += header.length + clipped.length;
  }
  return parts.join("\n\n");
}
