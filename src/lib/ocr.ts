import { chatVision } from "./llm";

// /no_think disables the reasoning chain on Qwen3 models — OCR is pure
// transcription, so thinking only adds minutes of latency for no benefit.
const OCR_PROMPT =
  "/no_think\n" +
  "Transcribe all text in this image exactly, preserving line breaks, numbering, and structure. " +
  "If the image contains a table, reproduce it as plain text rows. " +
  "Reply with only the transcribed text, no commentary or preamble.";

/** Longest image edge sent to the vision model; big photos are downscaled for speed. */
const OCR_MAX_DIMENSION = 1600;

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

/** Downscale an image so its longest edge is at most `maxDim` (JPEG, q85). */
async function downscale(buffer: Buffer, maxDim: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(buffer)
    .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

/** Run OCR on an image buffer using the local vision model. */
export async function ocrImage(buffer: Buffer, mimeType: string): Promise<string> {
  const image = await toJpegIfHeic(buffer, mimeType);
  const jpeg = await downscale(image.buffer, OCR_MAX_DIMENSION);
  const text = await chatVision({
    imageBase64: jpeg.toString("base64"),
    mimeType: "image/jpeg",
    prompt: OCR_PROMPT,
    maxTokens: 8000,
  });
  // Defensive: drop a stray /no_think control token if the model echoed it.
  return text.replace(/^\s*\/no_think\b/, "").trim();
}
