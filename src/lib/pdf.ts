import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dataDir, pdfOcrMaxPages, pdfOcrPageWidth } from "./env";
import { ocrImage } from "./ocr";
import { setMaterialPageCount, upsertMaterialPage } from "./material-pages";
import type { Material } from "./subjects";

const MAX_EXTRACTED_CHARS = 2_000_000;
const PAGE_TEXT_THRESHOLD = 80;

function pageImagePath(material: Material, pageNumber: number): string {
  const dir = path.join(dataDir(), "uploads", material.subject_id, material.id);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `page-${String(pageNumber).padStart(4, "0")}.jpg`);
}

type PdfParser = import("pdf-parse").PDFParse;

async function renderPageJpeg(parser: PdfParser, pageNumber: number): Promise<Buffer> {
  const result = await parser.getScreenshot({
    partial: [pageNumber],
    desiredWidth: pdfOcrPageWidth(),
    imageBuffer: true,
    imageDataUrl: false,
  });
  const page = result.pages[0];
  if (!page?.data?.length) throw new Error("page_render_failed");

  const sharp = (await import("sharp")).default;
  return sharp(Buffer.from(page.data)).jpeg({ quality: 85 }).toBuffer();
}

export async function processPdfMaterial(material: Material): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const stat = fs.statSync(material.stored_path);
  const parser = new PDFParse({
    url: pathToFileURL(material.stored_path).href,
    length: stat.size,
    rangeChunkSize: 262_144,
    disableAutoFetch: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });

  try {
    const info = await parser.getInfo();
    const total = info.total;
    setMaterialPageCount(material.id, total);

    const maxPages = pdfOcrMaxPages();
    const limit = maxPages > 0 ? Math.min(total, maxPages) : total;
    const parts: string[] = [];
    let chars = 0;
    let failedPages = 0;

    for (let pageNumber = 1; pageNumber <= limit; pageNumber++) {
      let text = "";
      let imagePath: string | null = null;
      let error: string | null = null;

      try {
        const textResult = await parser.getText({ partial: [pageNumber], pageJoiner: "" });
        text = textResult.text?.trim() ?? "";
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      if (text.length < PAGE_TEXT_THRESHOLD) {
        try {
          const jpeg = await renderPageJpeg(parser, pageNumber);
          imagePath = pageImagePath(material, pageNumber);
          fs.writeFileSync(imagePath, jpeg);
          const ocrText = await ocrImage(jpeg, "image/jpeg");
          if (ocrText.trim()) {
            text = ocrText.trim();
          }
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
      }

      if (text) {
        upsertMaterialPage(material.id, pageNumber, {
          imagePath,
          text,
          status: "ready",
          error: null,
        });
        parts.push(`### Page ${pageNumber}\n${text}`);
        chars += text.length;
      } else {
        failedPages++;
        upsertMaterialPage(material.id, pageNumber, {
          imagePath,
          text: null,
          status: "failed",
          error: error ?? "no_text_extracted",
        });
      }

      if (chars >= MAX_EXTRACTED_CHARS) break;
    }

    const combined = parts.join("\n\n");
    if (!combined.trim()) {
      if (failedPages > 0) throw new Error("pdf_ocr_failed");
      throw new Error("no_text_extracted");
    }
    if (combined.length > MAX_EXTRACTED_CHARS) {
      return `${combined.slice(0, MAX_EXTRACTED_CHARS)}\n\n[extracted text truncated]`;
    }
    return combined;
  } finally {
    await parser.destroy();
  }
}
