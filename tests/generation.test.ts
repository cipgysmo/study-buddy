import { describe, expect, it } from "vitest";
import { cleanDifficulty } from "@/lib/generation";

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
