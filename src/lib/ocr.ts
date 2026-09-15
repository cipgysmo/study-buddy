import { chatVision } from "./llm";

const OCR_PROMPT =
  "Transcribe all text in this image exactly, preserving line breaks, numbering, and structure. " +
  "If the image contains a table, reproduce it as plain text rows. " +
  "Reply with only the transcribed text, no commentary or preamble.";

/** Run OCR on an image buffer using the local vision model. */
export async function ocrImage(buffer: Buffer, mimeType: string): Promise<string> {
  const text = await chatVision({
    imageBase64: buffer.toString("base64"),
    mimeType,
    prompt: OCR_PROMPT,
  });
  return text.trim();
}
