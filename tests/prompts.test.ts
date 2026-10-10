import { describe, expect, it } from "vitest";
import { exerciseGeneratorPrompt } from "@/lib/prompts/exercises";
import { flashcardGeneratorPrompt } from "@/lib/prompts/flashcards";
import { quizGeneratorPrompt } from "@/lib/prompts/quiz";
import { similarExamPrompt } from "@/lib/prompts/similar-exam";
import { trueFalseGeneratorPrompt } from "@/lib/prompts/truefalse";
import { typedExerciseGeneratorPrompt } from "@/lib/prompts/typed-exercises";

describe("generation prompts", () => {
  it("includes the user's custom request", () => {
    const request = "make it similar to the uploaded examples";
    const prompts = [
      flashcardGeneratorPrompt({
        language: "English",
        subjectName: "Math",
        count: 2,
        context: "notes",
        customPrompt: request,
      }),
      quizGeneratorPrompt({
        language: "English",
        subjectName: "Math",
        count: 2,
        context: "notes",
        customPrompt: request,
      }),
      exerciseGeneratorPrompt({
        language: "English",
        subjectName: "Math",
        count: 2,
        context: "notes",
        customPrompt: request,
      }),
      trueFalseGeneratorPrompt({
        language: "English",
        subjectName: "Math",
        count: 2,
        context: "notes",
        customPrompt: request,
      }),
      similarExamPrompt({
        language: "English",
        subjectName: "Math",
        count: 2,
        examText: "exam",
        customPrompt: request,
      }),
      typedExerciseGeneratorPrompt({
        language: "English",
        subjectName: "Math",
        count: 2,
        context: "notes",
        customPrompt: request,
      }),
    ];

    for (const prompt of prompts) {
      expect(prompt).toContain(`Additional user request: ${request}`);
    }
  });
});
