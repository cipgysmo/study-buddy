import { describe, expect, it } from "vitest";
import { tutorSystemPrompt } from "@/lib/prompts/tutor";

describe("tutorSystemPrompt", () => {
  it("always sets the response language", () => {
    const p = tutorSystemPrompt("Czech");
    expect(p).toContain("Always respond in Czech.");
  });

  it("addresses the student by name when provided", () => {
    const p = tutorSystemPrompt("English", undefined, undefined, "Honza");
    expect(p).toContain("Honza");
    expect(p).toMatch(/student's name is Honza/);
  });

  it("omits the name block when absent or blank", () => {
    expect(tutorSystemPrompt("English")).not.toMatch(/student's name is/);
    expect(tutorSystemPrompt("English", undefined, undefined, "   ")).not.toMatch(
      /student's name is/
    );
  });

  it("lists focus topics when provided", () => {
    const p = tutorSystemPrompt("English", undefined, ["Fractions", "Decimals"]);
    expect(p).toContain("Focus the discussion on these topics: Fractions, Decimals.");
  });

  it("embeds subject notes in a <notes> block when provided", () => {
    const p = tutorSystemPrompt("English", "PYTHAGORAS NOTES");
    expect(p).toContain("<notes>");
    expect(p).toContain("PYTHAGORAS NOTES");
    expect(p).toContain("</notes>");
  });

  it("omits the notes block when context is blank", () => {
    expect(tutorSystemPrompt("English", "   ")).not.toContain("<notes>");
  });
});
