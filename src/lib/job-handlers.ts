import fs from "node:fs";
import { getDb } from "./db";
import { enqueueJob, registerJobHandler } from "./jobs";
import { ocrImage } from "./ocr";
import { generateFlashcards } from "./flashcards";
import { generateQuiz } from "./quizzes";
import { createPlan } from "./plans";
import { generateExercises, generateTrueFalse } from "./practice";
import { addMaterialWithText, getMaterial, linkMaterialParseJob, listMaterials, processMaterial } from "./subjects";
import { autoTagMaterialTopics } from "./topics";
import { generateSimilarExam, parseExam } from "./exams";
import { generateLesson } from "./lessons";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Coerce a payload's topicIds field to a clean string array. */
function topicIdArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

registerJobHandler("ocr", async ({ payload }) => {
  const materialId = str(payload.materialId);
  await processMaterial(materialId);
  // Exam papers are parsed into questions right after their text is extracted.
  const m = getMaterial(materialId);
  if (m?.role === "exam") {
    const job = enqueueJob("parseExam", { materialId });
    linkMaterialParseJob(materialId, job.id);
  } else if (m?.role === "notes") {
    await autoTagMaterialTopics(materialId);
  }
  return null;
});

registerJobHandler("retag", async ({ payload }) => {
  const subjectId = str(payload.subjectId);
  const materials = listMaterials(subjectId).filter(
    (m) => m.role === "notes" && m.extracted_text?.trim()
  );
  for (const m of materials) {
    await autoTagMaterialTopics(m.id);
  }
  return String(materials.length);
});

registerJobHandler("parseExam", async ({ payload }) => {
  const count = await parseExam(str(payload.materialId));
  return String(count);
});

registerJobHandler("similarExam", async ({ payload }) => {
  const durationMin =
    typeof payload.durationMin === "number" && payload.durationMin > 0
      ? payload.durationMin
      : 20;
  const quiz = await generateSimilarExam(
    str(payload.materialId),
    num(payload.count, 10),
    durationMin
  );
  return quiz.id;
});

registerJobHandler("scan", async ({ id, payload }) => {
  const tempPath = str(payload.tempPath);
  const filename = str(payload.filename) || "scan.png";
  const mime = str(payload.mime) || "image/png";
  const subjectId = str(payload.subjectId) || null;
  try {
    const buffer = fs.readFileSync(tempPath);
    const text = await ocrImage(buffer, mime);
    if (subjectId) {
      // Idempotent: a restart may re-run this job after the material was already saved.
      const existing = getDb().prepare("SELECT id FROM materials WHERE job_id = ?").get(id);
      if (!existing) {
        addMaterialWithText(subjectId, { filename, mime, buffer }, text, id);
      }
    }
    return text;
  } finally {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {
      /* ignore */
    }
  }
});

registerJobHandler("flashcards", async ({ payload }) => {
  await generateFlashcards(str(payload.subjectId), num(payload.count, 10), topicIdArray(payload.topicIds));
  return null;
});

registerJobHandler("quiz", async ({ payload }) => {
  const durationMin =
    typeof payload.durationMin === "number" && payload.durationMin > 0
      ? payload.durationMin
      : undefined;
  await generateQuiz(
    str(payload.subjectId),
    num(payload.count, 5),
    str(payload.title) || undefined,
    durationMin,
    topicIdArray(payload.topicIds)
  );
  return null;
});

registerJobHandler("plan", async ({ payload }) => {
  const plan = await createPlan({
    subjectId: str(payload.subjectId),
    title: str(payload.title) || "Study plan",
    examDate: str(payload.examDate),
    targetGrade: str(payload.targetGrade) || null,
    topicIds: topicIdArray(payload.topicIds),
  });
  return plan.id;
});

registerJobHandler("exercises", async ({ payload }) => {
  await generateExercises(str(payload.subjectId), num(payload.count, 5), topicIdArray(payload.topicIds));
  return null;
});

registerJobHandler("truefalse", async ({ payload }) => {
  await generateTrueFalse(str(payload.subjectId), num(payload.count, 5), topicIdArray(payload.topicIds));
  return null;
});

registerJobHandler("lesson", async ({ payload }) => {
  const count = await generateLesson(str(payload.lessonId));
  return String(count);
});
