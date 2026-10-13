import fs from "node:fs";
import { pathToFileURL } from "node:url";

export type MaterialKind = "pdf" | "image" | "text";

const PDF_PAGE_BATCH_SIZE = 25;
const MAX_EXTRACTED_CHARS = 2_000_000;

export function kindFromMime(mime: string, filename: string): MaterialKind {
  const lower = filename.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  return "text";
}

/**
 * Extract plain text from an uploaded file's bytes.
 * Returns null for images (OCR is handled later via the vision model, P7).
 */
export async function extractText(buffer: Buffer, kind: MaterialKind): Promise<string | null> {
  if (kind === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text ?? "";
    } finally {
      await parser.destroy();
    }
  }
  if (kind === "text") {
    return buffer.toString("utf-8");
  }
  return null; // image
}

/**
 * Extract text from a stored file. PDFs are loaded through a file URL and parsed
 * in page batches so large manuals do not need to be copied into memory all at once.
 */
export async function extractTextFromFile(filePath: string, kind: MaterialKind): Promise<string | null> {
  if (kind === "text") {
    return fs.readFileSync(filePath, "utf-8");
  }
  if (kind !== "pdf") return null;

  const { PDFParse } = await import("pdf-parse");
  const stat = fs.statSync(filePath);
  const parser = new PDFParse({
    url: pathToFileURL(filePath).href,
    length: stat.size,
    rangeChunkSize: 262_144,
    disableAutoFetch: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });

  try {
    const info = await parser.getInfo();
    const total = info.total;
    const parts: string[] = [];
    let chars = 0;

    for (let start = 1; start <= total && chars < MAX_EXTRACTED_CHARS; start += PDF_PAGE_BATCH_SIZE) {
      const end = Math.min(total, start + PDF_PAGE_BATCH_SIZE - 1);
      const pages: number[] = [];
      for (let page = start; page <= end; page++) pages.push(page);
      const result = await parser.getText({ partial: pages, pageJoiner: "\n-- page_number of total_number --" });
      const text = result.text ?? "";
      if (text) {
        parts.push(text);
        chars += text.length;
      }
    }

    const text = parts.join("\n\n");
    if (text.length > MAX_EXTRACTED_CHARS) {
      return `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n[extracted text truncated]`;
    }
    return text;
  } finally {
    await parser.destroy();
  }
}
