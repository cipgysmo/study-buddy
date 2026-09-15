import { PDFParse } from "pdf-parse";

export type MaterialKind = "pdf" | "image" | "text";

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
export async function extractText(
  buffer: Buffer,
  kind: MaterialKind
): Promise<string | null> {
  try {
    if (kind === "pdf") {
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
  } catch {
    return null;
  }
}
