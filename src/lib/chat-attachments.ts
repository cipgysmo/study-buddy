import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dataDir } from "./env";
import type { ChatAttachmentMeta, ChatAttachmentRow } from "./chat";

const MAX_CHAT_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_CHAT_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDF_TEXT_CHARS = 12000;

const SAFE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function classifyAttachment(mime: string): "image" | "pdf" | null {
  // SVG and other XML/HTML image types are excluded: they can carry scripts and
  // become stored-XSS vectors when served inline.
  if (SAFE_IMAGE_TYPES.has(mime)) return "image";
  if (mime === "application/pdf") return "pdf";
  return null;
}

export function maxBytesFor(kind: "image" | "pdf"): number {
  return kind === "image" ? MAX_CHAT_IMAGE_BYTES : MAX_CHAT_PDF_BYTES;
}

export function attachmentUrl(id: string): string {
  return `/api/chat/attachments/${id}`;
}

export function saveAttachmentFile(
  sessionId: string,
  attachmentId: string,
  mime: string,
  buffer: Buffer
): string {
  const dir = path.join(dataDir(), "uploads", "chat", sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const ext = mime === "application/pdf" ? ".pdf" : mime.split("/")[1]?.split("+")[0] || "img";
  const filePath = path.join(dir, `${attachmentId}.${ext}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

export function toMeta(row: ChatAttachmentRow): ChatAttachmentMeta {
  return { id: row.id, kind: row.kind, name: row.name, mime: row.mime };
}

async function extractPdfText(filePath: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const stat = fs.statSync(filePath);
  const parser = new PDFParse({
    url: pathToFileURL(filePath).href,
    length: stat.size,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  try {
    const result = await parser.getText();
    const text = (result.text ?? "").trim();
    return text.length > MAX_PDF_TEXT_CHARS
      ? `${text.slice(0, MAX_PDF_TEXT_CHARS)}\n[PDF text truncated]`
      : text;
  } finally {
    await parser.destroy();
  }
}

export type ModelContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/**
 * Build the multimodal content parts for a single user turn from its attachments.
 * Images go to the vision model inline; PDFs are flattened to extracted text.
 */
export async function buildAttachmentParts(
  attachments: ChatAttachmentMeta[]
): Promise<{ parts: ModelContentPart[]; pdfNote: string }> {
  const parts: ModelContentPart[] = [];
  const pdfTexts: string[] = [];
  for (const att of attachments) {
    const row = (await import("./chat")).getAttachment(att.id);
    if (!row || !fs.existsSync(row.path)) continue;
    if (row.kind === "image") {
      const b64 = fs.readFileSync(row.path).toString("base64");
      parts.push({ type: "image_url", image_url: { url: `data:${row.mime};base64,${b64}` } });
    } else {
      try {
        const text = await extractPdfText(row.path);
        if (text) pdfTexts.push(`### Attached PDF: ${row.name}\n${text}`);
      } catch {
        /* ignore unreadable pdf */
      }
    }
  }
  return { parts, pdfNote: pdfTexts.join("\n\n") };
}
