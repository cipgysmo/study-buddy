/**
 * Prompts for guided lessons: an outline pass (chapter titles + summaries)
 * followed by a per-chapter pass (explanation + optional diagram + a
 * check-understanding question). Kept as two passes so each LLM call stays
 * small and the reader can show chapters as they are written.
 */

import { DIAGRAM_INSTRUCTION } from "./diagram";

export interface OutlineChapter {
  title: string;
  summary: string;
}

export interface LessonOutline {
  title: string;
  chapters: OutlineChapter[];
}

export interface CheckUnderstanding {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface LessonChapterDraft {
  explanation?: string;
  diagram?: string;
  check?: CheckUnderstanding;
  figureIndexes?: number[];
}

export interface FigureOption {
  index: number;
  label: string;
}

const SVG_RULE = DIAGRAM_INSTRUCTION;

export function lessonOutlinePrompt(opts: {
  language: string;
  subjectName: string;
  topicNames: string[];
  notes: string;
}): string {
  const topics = opts.topicNames.length ? ` Focus on: ${opts.topicNames.join(", ")}.` : "";
  return [
    "/no_think",
    "You are designing a guided lesson for a student around 13 years old.",
    `Subject: ${opts.subjectName}.${topics}`,
    `Respond in ${opts.language}.`,
    "From the student's notes below, break the material into a clear, ordered sequence of 3-6 chapters, each a digestible step.",
    'Return ONLY a JSON object: {"title": string, "chapters": [{"title": string, "summary": string}]}.',
    "Give the lesson a short title. Each chapter title is a few words; each summary is one sentence saying what that chapter teaches.",
    "",
    "<notes>",
    opts.notes,
    "</notes>",
  ].join("\n");
}

export function lessonChapterPrompt(opts: {
  language: string;
  subjectName: string;
  lessonTitle: string;
  chapterTitle: string;
  chapterSummary: string;
  notes: string;
  figures?: FigureOption[];
}): string {
  const lines = [
    "/no_think",
    "You are writing ONE chapter of a guided lesson for a student around 13 years old.",
    `Subject: ${opts.subjectName}. Lesson: ${opts.lessonTitle}.`,
    `Chapter: ${opts.chapterTitle}. It covers: ${opts.chapterSummary}.`,
    `Respond in ${opts.language}.`,
    "Explain the chapter clearly, patiently and step by step at the student's level. Use short paragraphs, bullet lists and one or two simple worked examples. Write in plain Markdown.",
    "You may use math: inline with $...$ and display on its own line with $$...$$.",
    "Ground the explanation in the student's notes when relevant, but make it self-contained and easy to follow.",
    "Also provide:",
    '- "explanation": the chapter text (Markdown).',
    `- "diagram": OPTIONAL. ${SVG_RULE}`,
    '- "check": one check-understanding multiple-choice question: {"question": string, "options": [string, string, string], "answerIndex": number, "explanation": string}. answerIndex is the 0-based index of the correct option.',
  ];

  if (opts.figures?.length) {
    const list = opts.figures.map((f) => `${f.index}. ${f.label}`).join("\n");
    lines.push(
      "The student has these image figures from their own material (refer to them by their number):",
      list,
      '- "figureIndexes": OPTIONAL array of the numbers above whose image clearly belongs to THIS chapter. Use the filename as the only hint; return [] if none fit.'
    );
  }

  lines.push(
    'Return ONLY a JSON object: {"explanation": string, "diagram": string, "check": {"question": string, "options": [string], "answerIndex": number, "explanation": string}, "figureIndexes": [number]}.',
    "",
    "<notes>",
    opts.notes,
    "</notes>"
  );
  return lines.join("\n");
}
