import { listMaterials } from "./subjects";

/**
 * Concatenate a subject's extracted material text into a single context block,
 * truncated to a character budget so it fits the model's context window.
 */
export function buildSubjectContext(subjectId: string, maxChars = 60000): string {
  const materials = listMaterials(subjectId);
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
