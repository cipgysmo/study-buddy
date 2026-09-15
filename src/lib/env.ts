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

/** Where the SQLite DB + uploaded files live. */
export function dataDir(): string {
  return read("DATA_DIR", path.join(process.cwd(), "data"));
}

/** Optional LAN password gate (empty = disabled). */
export function appPassword(): string {
  return read("APP_PASSWORD", "");
}
