import { getDb, getSetting, setSetting } from "./db";
import {
  llmApiKey as envApiKey,
  llmBaseUrl as envBaseUrl,
  llmModel as envModel,
} from "./env";

const BASE_URL_KEY = "llm_base_url";
const MODEL_KEY = "llm_model";
const API_KEY_KEY = "llm_api_key";
const VISION_MODEL_KEY = "llm_vision_model";

function cleanBaseUrl(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 500);
}

function cleanModel(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 200);
}

function cleanApiKey(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 500);
}

function setOrDelete(key: string, value: string): void {
  if (value) {
    setSetting(key, value);
  } else {
    getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
  }
}

export function llmBaseUrl(): string {
  return cleanBaseUrl(getSetting(BASE_URL_KEY)) || envBaseUrl();
}

export function llmModel(): string {
  return cleanModel(getSetting(MODEL_KEY)) || envModel();
}

export function llmApiKey(): string {
  return cleanApiKey(getSetting(API_KEY_KEY)) || envApiKey();
}

export function llmVisionModel(): string {
  return cleanModel(getSetting(VISION_MODEL_KEY)) || llmModel();
}

export function getLlmSettings() {
  return {
    baseUrl: cleanBaseUrl(getSetting(BASE_URL_KEY)),
    model: cleanModel(getSetting(MODEL_KEY)),
    visionModel: cleanModel(getSetting(VISION_MODEL_KEY)),
    apiKeySet: Boolean(getSetting(API_KEY_KEY)),
    effectiveBaseUrl: llmBaseUrl(),
    effectiveModel: llmModel(),
    effectiveVisionModel: llmVisionModel(),
  };
}

export function updateLlmSettings(input: {
  baseUrl?: unknown;
  model?: unknown;
  visionModel?: unknown;
  apiKey?: unknown;
  clearApiKey?: unknown;
}): void {
  if (input.baseUrl !== undefined) setOrDelete(BASE_URL_KEY, cleanBaseUrl(input.baseUrl));
  if (input.model !== undefined) setOrDelete(MODEL_KEY, cleanModel(input.model));
  if (input.visionModel !== undefined) setOrDelete(VISION_MODEL_KEY, cleanModel(input.visionModel));
  if (input.clearApiKey === true) {
    setOrDelete(API_KEY_KEY, "");
  } else if (input.apiKey !== undefined) {
    setOrDelete(API_KEY_KEY, cleanApiKey(input.apiKey));
  }
}
