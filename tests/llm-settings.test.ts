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
import { getLlmSettings, llmApiKey, llmBaseUrl, llmModel, llmVisionModel, updateLlmSettings } from "@/lib/llm-settings";

beforeAll(() => {
  getDb()
    .prepare("DELETE FROM settings WHERE key IN ('llm_base_url', 'llm_model', 'llm_api_key', 'llm_vision_model')")
    .run();
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("llm settings", () => {
  it("falls back to environment values", () => {
    expect(llmBaseUrl()).toBe("http://env.example/v1/");
    expect(llmModel()).toBe("env-model");
    expect(llmApiKey()).toBe("env-key");
    expect(llmVisionModel()).toBe("env-model");
  });

  it("uses persisted settings and optional vision model", () => {
    updateLlmSettings({
      baseUrl: "http://db.example/v1/",
      model: "db-model",
      visionModel: "vision-model",
      apiKey: "db-key",
    });

    expect(llmBaseUrl()).toBe("http://db.example/v1/");
    expect(llmModel()).toBe("db-model");
    expect(llmApiKey()).toBe("db-key");
    expect(llmVisionModel()).toBe("vision-model");

    const settings = getLlmSettings();
    expect(settings.apiKeySet).toBe(true);
    expect(settings).not.toHaveProperty("apiKey");
  });

  it("can clear persisted values back to env defaults", () => {
    updateLlmSettings({ baseUrl: "", model: "", visionModel: "", clearApiKey: true });
    expect(llmBaseUrl()).toBe("http://env.example/v1/");
    expect(llmModel()).toBe("env-model");
    expect(llmApiKey()).toBe("env-key");
    expect(llmVisionModel()).toBe("env-model");
  });
});
