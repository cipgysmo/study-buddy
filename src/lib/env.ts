import path from "node:path";

function read(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

/** OpenAI-compatible endpoint (llama-swap router on the AI host). */
export function llmBaseUrl(): string {
  return read("LLM_BASE_URL", "http://192.168.1.136:8080/v1/");
}

/** Model id exposed by the router. */
export function llmModel(): string {
  return read("LLM_MODEL", "local-ai");
}

/** Some OpenAI-compatible servers require a key; llama-swap ignores it. */
export function llmApiKey(): string {
  return read("LLM_API_KEY", "local");
}

/** How long to wait/retry when the local LLM is busy or temporarily unavailable. */
export function llmBusyTimeoutMs(): number {
  const v = Number(read("LLM_BUSY_TIMEOUT_MS", "600000"));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 600000;
}

/** Local LLM concurrency cap used by the in-process request queue. */
export function llmMaxConcurrency(): number {
  const v = Number(read("LLM_MAX_CONCURRENCY", "2"));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 2;
}

/** Hard timeout for a single upstream LLM request before it is retried. */
export function llmRequestTimeoutMs(): number {
  const v = Number(read("LLM_REQUEST_TIMEOUT_MS", "360000"));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 360000;
}

/** Where the SQLite DB + uploaded files live. */
export function dataDir(): string {
  return read("DATA_DIR", path.join(process.cwd(), "data"));
}

/** Optional LAN password gate (empty = disabled). */
export function appPassword(): string {
  return read("APP_PASSWORD", "");
}

/** Maximum accepted material upload size in bytes. */
export function maxUploadBytes(): number {
  const v = Number(read("MAX_UPLOAD_BYTES", String(1024 * 1024 * 1024)));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 1024 * 1024 * 1024;
}

/** Maximum accepted size for one chunked-upload request body. */
export function maxUploadChunkBytes(): number {
  const v = Number(read("MAX_UPLOAD_CHUNK_BYTES", String(8 * 1024 * 1024)));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 8 * 1024 * 1024;
}

/** Maximum PDF pages to OCR. 0 means no limit. */
export function pdfOcrMaxPages(): number {
  const v = Number(read("PDF_OCR_MAX_PAGES", "0"));
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

/** Rendered PDF page width used for OCR. */
export function pdfOcrPageWidth(): number {
  const v = Number(read("PDF_OCR_PAGE_WIDTH", "1600"));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 1600;
}
