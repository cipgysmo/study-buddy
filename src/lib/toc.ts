import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { listMaterialPageTextsInRange, tagMaterialPages } from "./material-pages";
import { addMaterialTopics, resolveTopicId } from "./topics";

export interface TocEntry {
  title: string;
  level: number;
  printedPage: number;
  pdfPageStart: number;
  pdfPageEnd: number | null;
}

interface RawTocEntry {
  title: string;
  level: number;
  printedPage: number;
}

const TOC_HEADINGS = [
  "obsah",
  "table of contents",
  "contents",
  "index",
  "osnova",
  "rejstřík",
];

const LINE_WITH_PAGE = /^(.{3,120}?)(?:[.…·\-–—\s]{2,})(\d{1,4})$/;
const BARE_TITLE_PAGE = /^(.{3,120}?)\s+(\d{1,4})$/;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[•\-*]\s*/, "")
    .trim();
}

function detectLevel(line: string): number {
  const leading = line.match(/^\s+/)?.[0].length ?? 0;
  const numberMatch = line.trim().match(/^(\d+(?:\.\d+)*)[.)]?\s+/);
  const numberLevel = numberMatch ? numberMatch[1].split(".").length : 0;
  const indentLevel = Math.floor(leading / 2) + 1;
  return Math.max(1, Math.min(4, Math.max(numberLevel, indentLevel)));
}

function parseTocLine(line: string): RawTocEntry | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 5) return null;

  let match = LINE_WITH_PAGE.exec(trimmed);
  if (!match) match = BARE_TITLE_PAGE.exec(trimmed);
  if (!match) return null;

  const title = cleanTitle(match[1]);
  const page = Number(match[2]);
  if (!title || !Number.isFinite(page) || page <= 0) return null;
  if (normalize(title).length < 3) return null;

  return { title, level: detectLevel(line), printedPage: page };
}

function isTocPage(text: string): boolean {
  const lower = text.toLowerCase();
  if (TOC_HEADINGS.some((heading) => lower.includes(heading))) return true;
  const lines = text.split(/\r?\n/).filter((line) => parseTocLine(line));
  return lines.length >= 5;
}

function findPdfPageForTitle(
  title: string,
  printedPage: number,
  pages: Map<number, string>,
  total: number,
  skipPages: Set<number>
): number {
  const needle = normalize(title);
  if (needle.length < 4) return Math.min(total, Math.max(1, printedPage));

  const start = Math.max(1, printedPage - 8);
  const end = Math.min(total, printedPage + 30);
  for (let page = start; page <= end; page++) {
    if (skipPages.has(page)) continue;
    const text = pages.get(page);
    if (text && normalize(text).includes(needle)) return page;
  }
  return Math.min(total, Math.max(1, printedPage));
}

export function extractTocEntries(
  pages: { page_number: number; text: string | null }[],
  total: number
): TocEntry[] {
  const pageTexts = new Map<number, string>();
  for (const page of pages) {
    if (page.text) pageTexts.set(page.page_number, page.text);
  }

  const tocPages = pages
    .filter((page) => page.page_number <= Math.min(total, 20) && page.text && isTocPage(page.text))
    .map((page) => page.page_number);
  if (tocPages.length === 0) return [];

  const raw: RawTocEntry[] = [];
  for (const pageNumber of tocPages) {
    const text = pageTexts.get(pageNumber);
    if (!text) continue;
    for (const line of text.split(/\r?\n/)) {
      const entry = parseTocLine(line);
      if (entry) raw.push(entry);
    }
  }

  const seen = new Set<string>();
  const unique = raw.filter((entry) => {
    const key = `${normalize(entry.title)}:${entry.printedPage}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const filtered = unique
    .filter((entry) => entry.printedPage <= total + 10)
    .sort((a, b) => a.printedPage - b.printedPage || a.title.localeCompare(b.title));

  const maxEntries = filtered.length > 80 ? filtered.filter((entry) => entry.level <= 2) : filtered;
  const limited = maxEntries.slice(0, 80);

  const mapped: TocEntry[] = limited.map((entry) => {
    const pdfPageStart = findPdfPageForTitle(
      entry.title,
      entry.printedPage,
      pageTexts,
      total,
      new Set(tocPages)
    );
    return {
      title: entry.title,
      level: entry.level,
      printedPage: entry.printedPage,
      pdfPageStart,
      pdfPageEnd: null,
    };
  });

  mapped.sort((a, b) => a.pdfPageStart - b.pdfPageStart || a.printedPage - b.printedPage);
  for (let i = 0; i < mapped.length; i++) {
    const next = mapped[i + 1];
    mapped[i].pdfPageEnd = next ? Math.max(mapped[i].pdfPageStart, next.pdfPageStart - 1) : total;
  }

  return mapped;
}

export function listMaterialTocEntries(materialId: string) {
  return getDb()
    .prepare(
      `SELECT id, material_id, topic_id, title, level, printed_page, pdf_page_start, pdf_page_end, created_at
       FROM material_toc_entries
       WHERE material_id = ?
       ORDER BY pdf_page_start ASC, printed_page ASC`
    )
    .all(materialId) as {
    id: string;
    material_id: string;
    topic_id: string | null;
    title: string;
    level: number;
    printed_page: number;
    pdf_page_start: number;
    pdf_page_end: number | null;
    created_at: string;
  }[];
}

export function saveTocEntries(materialId: string, subjectId: string, entries: TocEntry[]): number {
  if (entries.length === 0) return 0;
  const db = getDb();
  db.prepare("DELETE FROM material_toc_entries WHERE material_id = ?").run(materialId);

  const insert = db.prepare(
    `INSERT INTO material_toc_entries
      (id, material_id, topic_id, title, level, printed_page, pdf_page_start, pdf_page_end)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const topicIds: string[] = [];

  for (const entry of entries) {
    const topicId = resolveTopicId(subjectId, entry.title);
    if (topicId) topicIds.push(topicId);
    insert.run(
      randomUUID(),
      materialId,
      topicId,
      entry.title,
      entry.level,
      entry.printedPage,
      entry.pdfPageStart,
      entry.pdfPageEnd
    );

    if (topicId && entry.pdfPageEnd) {
      tagMaterialPages(materialId, entry.pdfPageStart, entry.pdfPageEnd, topicId);
    }
  }

  addMaterialTopics(materialId, topicIds);
  return entries.length;
}

export function getTopicPageRanges(topicIds: string[], materialIds?: string[]) {
  if (topicIds.length === 0) return [];
  const placeholders = topicIds.map(() => "?").join(",");
  const materialFilter = materialIds && materialIds.length > 0
    ? `AND material_id IN (${materialIds.map(() => "?").join(",")})`
    : "";
  const rows = getDb()
    .prepare(
      `SELECT material_id, topic_id, title, pdf_page_start, pdf_page_end
       FROM material_toc_entries
       WHERE topic_id IN (${placeholders}) ${materialFilter}
       ORDER BY material_id, pdf_page_start`
    )
    .all(...topicIds, ...(materialIds ?? [])) as {
    material_id: string;
    topic_id: string | null;
    title: string;
    pdf_page_start: number;
    pdf_page_end: number | null;
  }[];
  return rows;
}

export function processMaterialToc(materialId: string): number {
  const material = getDb()
    .prepare("SELECT id, subject_id, kind, page_count FROM materials WHERE id = ?")
    .get(materialId) as { id: string; subject_id: string; kind: string; page_count: number | null } | undefined;
  if (!material || material.kind !== "pdf" || !material.page_count) return 0;

  const pages = listMaterialPageTextsInRange(materialId, 1, material.page_count).map((page) => ({
    page_number: page.page_number,
    text: page.text,
  }));
  const entries = extractTocEntries(pages, material.page_count);
  return saveTocEntries(materialId, material.subject_id, entries);
}
