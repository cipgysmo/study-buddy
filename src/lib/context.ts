import { listMaterialIdsInColumns } from "./board";
import { getDb } from "./db";
import { listMaterialPageTextsInRange } from "./material-pages";
import { getMaterialText, listMaterials } from "./subjects";
import { getTopicPageRanges } from "./toc";

export interface SubjectContextOptions {
  columnIds?: string[];
  keywords?: string[];
}

export interface SourceRef {
  materialId: string;
  filename: string;
  title?: string;
  pageStart?: number;
  pageEnd?: number;
}

export interface SubjectContextResult {
  text: string;
  sources: SourceRef[];
}

function materialHeader(filename: string, pageCount: number | null): string {
  return pageCount ? `### ${filename} (pages 1-${pageCount})\n` : `### ${filename}\n`;
}

function buildTocContext(
  materials: { id: string; filename: string }[],
  topicIds: string[],
  maxChars: number
): { text: string; coveredMaterialIds: Set<string>; sources: SourceRef[] } {
  const ranges = getTopicPageRanges(topicIds, materials.map((m) => m.id));
  const covered = new Set<string>();
  if (ranges.length === 0) return { text: "", coveredMaterialIds: covered, sources: [] };

  const byMaterial = new Map<string, typeof ranges>();
  for (const range of ranges) {
    const list = byMaterial.get(range.material_id) ?? [];
    list.push(range);
    byMaterial.set(range.material_id, list);
  }

  const parts: string[] = [];
  const sources: SourceRef[] = [];
  let total = 0;

  for (const material of materials) {
    const materialRanges = byMaterial.get(material.id);
    if (!materialRanges) continue;
    covered.add(material.id);

    for (const range of materialRanges) {
      if (total >= maxChars) break;
      const end = range.pdf_page_end ?? range.pdf_page_start;
      const pages = listMaterialPageTextsInRange(material.id, range.pdf_page_start, end);
      if (pages.length === 0) continue;

      sources.push({
        materialId: material.id,
        filename: material.filename,
        title: range.title,
        pageStart: range.pdf_page_start,
        pageEnd: end,
      });
      const header = `### ${material.filename} — ${range.title} (pages ${range.pdf_page_start}-${end})\n`;
      const body = pages.map((page) => `[page ${page.page_number}]\n${page.text}`).join("\n\n");
      const room = maxChars - total;
      const clipped = body.length > room ? body.slice(0, room) : body;
      parts.push(header + clipped);
      total += header.length + clipped.length;
    }
  }

  return { text: parts.join("\n\n"), coveredMaterialIds: covered, sources };
}

/**
 * Concatenate a subject's extracted material text into a single context block,
 * truncated to a character budget so it fits the model's context window.
 *
 * Topic filters fall back to the current material pool when they match nothing.
 * Container filters are strict: selecting a container should not silently pull
 * in materials from outside it.
 */
export function buildSubjectContextWithSources(
  subjectId: string,
  topicIds?: string[],
  maxChars = 60000,
  opts: SubjectContextOptions = {}
): SubjectContextResult {
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
  const sources: SourceRef[] = [];
  let total = 0;
  let coveredMaterialIds = new Set<string>();

  if (topicIds && topicIds.length > 0) {
    const toc = buildTocContext(materials, topicIds, maxChars);
    if (toc.text) {
      parts.push(toc.text);
      total += toc.text.length;
      coveredMaterialIds = toc.coveredMaterialIds;
      sources.push(...toc.sources);
    }
  }

  for (const m of materials) {
    if (coveredMaterialIds.has(m.id)) continue;
    if (m.extracted_text_length <= 0) continue;
    if (total >= maxChars) break;
    const text = getMaterialText(m.id);
    if (!text) continue;
    sources.push({
      materialId: m.id,
      filename: m.filename,
      pageStart: 1,
      pageEnd: m.page_count ?? undefined,
    });
    const header = materialHeader(m.filename, m.page_count);
    const room = maxChars - total;
    const clipped = text.length > room ? text.slice(0, room) : text;
    parts.push(header + clipped);
    total += header.length + clipped.length;
  }
  return { text: parts.join("\n\n"), sources };
}

export function buildSubjectContext(
  subjectId: string,
  topicIds?: string[],
  maxChars = 60000,
  opts: SubjectContextOptions = {}
): string {
  return buildSubjectContextWithSources(subjectId, topicIds, maxChars, opts).text;
}
