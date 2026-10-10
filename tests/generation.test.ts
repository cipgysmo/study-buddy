import { describe, expect, it } from "vitest";
import { cleanCustomPrompt, cleanDifficulty } from "@/lib/generation";

describe("generation difficulty", () => {
  it("accepts supported difficulty values", () => {
    expect(cleanDifficulty("balanced")).toBe("balanced");
    expect(cleanDifficulty("easy")).toBe("easy");
    expect(cleanDifficulty("medium")).toBe("medium");
    expect(cleanDifficulty("hard")).toBe("hard");
    expect(cleanDifficulty("expert")).toBe("expert");
  });

  it("falls back to balanced for invalid values", () => {
    expect(cleanDifficulty(undefined)).toBe("balanced");
    expect(cleanDifficulty("nope")).toBe("balanced");
    expect(cleanDifficulty(123)).toBe("balanced");
  });
});

describe("generation custom prompt", () => {
  it("trims and keeps valid custom prompts", () => {
    expect(cleanCustomPrompt("  more geometry  ")).toBe("more geometry");
  });

  it("returns undefined for empty or invalid custom prompts", () => {
    expect(cleanCustomPrompt(undefined)).toBeUndefined();
    expect(cleanCustomPrompt("   ")).toBeUndefined();
    expect(cleanCustomPrompt(123)).toBeUndefined();
  });

  it("caps very long custom prompts", () => {
    expect(cleanCustomPrompt("x".repeat(2500))).toHaveLength(2000);
  });
});
