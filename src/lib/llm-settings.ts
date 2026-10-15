import { getDb, getSetting, setSetting } from "./db";
import {
  llmApiKey as envApiKey,
  llmBaseUrl as envBaseUrl,
  llmModel as envModel,
} from "./env";

const LANGUAGE_ENABLED_KEY = "llm_language_enabled";
const BASE_URL_KEY = "llm_base_url";
const MODEL_KEY = "llm_model";
const API_KEY_KEY = "llm_api_key";

const VISION_ENABLED_KEY = "llm_vision_enabled";
const VISION_BASE_URL_KEY = "llm_vision_base_url";
const VISION_MODEL_KEY = "llm_vision_model";
const VISION_API_KEY_KEY = "llm_vision_api_key";

function cleanBaseUrl(value: unknown): string {
  const text = (typeof value === "string" ? value.trim() : "").slice(0, 500);
  if (!text) return "";
  // Only http(s) endpoints are allowed (blocks file:, gopher:, etc. SSRF vectors).
  try {
    const u = new URL(text);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
  } catch {
    return "";
  }
  return text;
}

function cleanModel(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 200);
}

function cleanApiKey(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 500);
}

function cleanEnabled(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

function setOrDelete(key: string, value: string): void {
  if (value) {
    setSetting(key, value);
  } else {
    getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
  }
}

function setEnabled(key: string, value: boolean): void {
  if (value) {
    setSetting(key, "1");
  } else {
    getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
  }
}

function getEnabled(key: string): boolean {
  return getSetting(key) === "1";
}

export function languageModelEnabled(): boolean {
  return getEnabled(LANGUAGE_ENABLED_KEY);
}

export function visionModelEnabled(): boolean {
  return getEnabled(VISION_ENABLED_KEY);
}

export function llmBaseUrl(): string {
  return (languageModelEnabled() && cleanBaseUrl(getSetting(BASE_URL_KEY))) || envBaseUrl();
}

export function llmModel(): string {
  return (languageModelEnabled() && cleanModel(getSetting(MODEL_KEY))) || envModel();
}

export function llmApiKey(): string {
  return (languageModelEnabled() && cleanApiKey(getSetting(API_KEY_KEY))) || envApiKey();
}

export function visionBaseUrl(): string {
  return (
    (visionModelEnabled() && cleanBaseUrl(getSetting(VISION_BASE_URL_KEY))) ||
    llmBaseUrl()
  );
}

export function visionModel(): string {
  return (
    (visionModelEnabled() && cleanModel(getSetting(VISION_MODEL_KEY))) ||
    llmModel()
  );
}

export function visionApiKey(): string {
  return (
    (visionModelEnabled() && cleanApiKey(getSetting(VISION_API_KEY_KEY))) ||
    llmApiKey()
  );
}

export function getLlmSettings() {
  return {
    languageEnabled: languageModelEnabled(),
    baseUrl: cleanBaseUrl(getSetting(BASE_URL_KEY)),
    model: cleanModel(getSetting(MODEL_KEY)),
    apiKeySet: Boolean(getSetting(API_KEY_KEY)),

    visionEnabled: visionModelEnabled(),
    visionBaseUrl: cleanBaseUrl(getSetting(VISION_BASE_URL_KEY)),
    visionModel: cleanModel(getSetting(VISION_MODEL_KEY)),
    visionApiKeySet: Boolean(getSetting(VISION_API_KEY_KEY)),

    effectiveBaseUrl: llmBaseUrl(),
    effectiveModel: llmModel(),
    effectiveVisionBaseUrl: visionBaseUrl(),
    effectiveVisionModel: visionModel(),
  };
}

export function updateLlmSettings(input: {
  languageEnabled?: unknown;
  baseUrl?: unknown;
  model?: unknown;
  apiKey?: unknown;
  clearApiKey?: unknown;

  visionEnabled?: unknown;
  visionBaseUrl?: unknown;
  visionModel?: unknown;
  visionApiKey?: unknown;
  clearVisionApiKey?: unknown;
}): void {
  if (input.languageEnabled !== undefined) setEnabled(LANGUAGE_ENABLED_KEY, cleanEnabled(input.languageEnabled));
  if (input.baseUrl !== undefined) setOrDelete(BASE_URL_KEY, cleanBaseUrl(input.baseUrl));
  if (input.model !== undefined) setOrDelete(MODEL_KEY, cleanModel(input.model));
  if (input.clearApiKey === true) {
    setOrDelete(API_KEY_KEY, "");
  } else if (input.apiKey !== undefined) {
    setOrDelete(API_KEY_KEY, cleanApiKey(input.apiKey));
  }

  if (input.visionEnabled !== undefined) setEnabled(VISION_ENABLED_KEY, cleanEnabled(input.visionEnabled));
  if (input.visionBaseUrl !== undefined) setOrDelete(VISION_BASE_URL_KEY, cleanBaseUrl(input.visionBaseUrl));
  if (input.visionModel !== undefined) setOrDelete(VISION_MODEL_KEY, cleanModel(input.visionModel));
  if (input.clearVisionApiKey === true) {
    setOrDelete(VISION_API_KEY_KEY, "");
  } else if (input.visionApiKey !== undefined) {
    setOrDelete(VISION_API_KEY_KEY, cleanApiKey(input.visionApiKey));
  }
}
