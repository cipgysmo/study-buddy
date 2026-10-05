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
  const v = Number(read("LLM_BUSY_TIMEOUT_MS", "300000"));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 300000;
}

/** Local LLM concurrency cap used by the in-process request queue. */
export function llmMaxConcurrency(): number {
  const v = Number(read("LLM_MAX_CONCURRENCY", "2"));
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 2;
}

/** Where the SQLite DB + uploaded files live. */
export function dataDir(): string {
  return read("DATA_DIR", path.join(process.cwd(), "data"));
}

/** Optional LAN password gate (empty = disabled). */
export function appPassword(): string {
  return read("APP_PASSWORD", "");
}
