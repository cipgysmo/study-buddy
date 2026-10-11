import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-llm-settings-"));
process.env.DATA_DIR = dir;
process.env.LLM_BASE_URL = "http://env.example/v1/";
process.env.LLM_MODEL = "env-model";
process.env.LLM_API_KEY = "env-key";

import { getDb } from "@/lib/db";
import {
  getLlmSettings,
  llmApiKey,
  llmBaseUrl,
  llmModel,
  updateLlmSettings,
  visionApiKey,
  visionBaseUrl,
  visionModel,
} from "@/lib/llm-settings";

beforeAll(() => {
  getDb()
    .prepare(
      `DELETE FROM settings
       WHERE key IN (
         'llm_language_enabled', 'llm_base_url', 'llm_model', 'llm_api_key',
         'llm_vision_enabled', 'llm_vision_base_url', 'llm_vision_model', 'llm_vision_api_key'
       )`
    )
    .run();
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("llm settings", () => {
  it("falls back to environment values when overrides are disabled", () => {
    expect(llmBaseUrl()).toBe("http://env.example/v1/");
    expect(llmModel()).toBe("env-model");
    expect(llmApiKey()).toBe("env-key");
    expect(visionBaseUrl()).toBe("http://env.example/v1/");
    expect(visionModel()).toBe("env-model");
    expect(visionApiKey()).toBe("env-key");
  });

  it("uses language overrides when enabled", () => {
    updateLlmSettings({
      languageEnabled: true,
      baseUrl: "http://language.example/v1/",
      model: "language-model",
      apiKey: "language-key",
    });

    expect(llmBaseUrl()).toBe("http://language.example/v1/");
    expect(llmModel()).toBe("language-model");
    expect(llmApiKey()).toBe("language-key");
    expect(visionBaseUrl()).toBe("http://language.example/v1/");
    expect(visionModel()).toBe("language-model");
    expect(visionApiKey()).toBe("language-key");
  });

  it("can override only the vision model", () => {
    updateLlmSettings({
      visionEnabled: true,
      visionModel: "vision-model",
    });

    expect(visionBaseUrl()).toBe("http://language.example/v1/");
    expect(visionModel()).toBe("vision-model");
    expect(visionApiKey()).toBe("language-key");
  });

  it("can fully override the vision model", () => {
    updateLlmSettings({
      visionBaseUrl: "http://vision.example/v1/",
      visionApiKey: "vision-key",
    });

    expect(visionBaseUrl()).toBe("http://vision.example/v1/");
    expect(visionModel()).toBe("vision-model");
    expect(visionApiKey()).toBe("vision-key");

    const settings = getLlmSettings();
    expect(settings.apiKeySet).toBe(true);
    expect(settings.visionApiKeySet).toBe(true);
    expect(settings).not.toHaveProperty("apiKey");
    expect(settings).not.toHaveProperty("visionApiKey");
  });

  it("can clear overrides back to env defaults", () => {
    updateLlmSettings({
      languageEnabled: false,
      baseUrl: "",
      model: "",
      clearApiKey: true,
      visionEnabled: false,
      visionBaseUrl: "",
      visionModel: "",
      clearVisionApiKey: true,
    });

    expect(llmBaseUrl()).toBe("http://env.example/v1/");
    expect(llmModel()).toBe("env-model");
    expect(llmApiKey()).toBe("env-key");
    expect(visionBaseUrl()).toBe("http://env.example/v1/");
    expect(visionModel()).toBe("env-model");
    expect(visionApiKey()).toBe("env-key");
  });
});
