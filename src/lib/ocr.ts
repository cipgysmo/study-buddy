import { chatVision } from "./llm";

const OCR_PROMPT =
  "Transcribe all text in this image exactly, preserving line breaks, numbering, and structure. " +
  "If the image contains a table, reproduce it as plain text rows. " +
  "Reply with only the transcribed text, no commentary or preamble.";

/**
 * Vision servers decode only common formats (JPEG/PNG/WebP) and reject
 * HEIC/HEIF (iPhone photos) with a 400. Decode HEIC to raw pixels
 * (heic-decode, WASM — applies the EXIF orientation) and re-encode as
 * JPEG (sharp, which cannot decode HEIC itself).
 */
export async function toJpegIfHeic(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (mimeType !== "image/heic" && mimeType !== "image/heif") {
    return { buffer, mimeType };
  }
  const decode = (await import("heic-decode")).default;
  const { width, height, data } = await decode({ buffer });
  const sharp = (await import("sharp")).default;
  const jpeg = await sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  return { buffer: jpeg, mimeType: "image/jpeg" };
}

/** Run OCR on an image buffer using the local vision model. */
export async function ocrImage(buffer: Buffer, mimeType: string): Promise<string> {
  const image = await toJpegIfHeic(buffer, mimeType);
  const text = await chatVision({
    imageBase64: image.buffer.toString("base64"),
    mimeType: image.mimeType,
    prompt: OCR_PROMPT,
  });
  return text.trim();
}
