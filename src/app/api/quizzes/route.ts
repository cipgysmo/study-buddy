import { cleanDifficulty } from "@/lib/generation";
import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { listQuizzes } from "@/lib/quizzes";
import { cleanStringArray } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ quizzes: listQuizzes() });
}

export async function POST(req: Request) {
  let body: {
    subjectId?: string;
    count?: number;
    title?: string;
    durationMin?: number;
    topicIds?: string[];
    columnIds?: string[];
    keywords?: string[];
    difficulty?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (!body.subjectId) return Response.json({ error: "subjectId_required" }, { status: 400 });
  const count = Math.max(1, Math.min(30, body.count ?? 5));
  const durationMin =
    typeof body.durationMin === "number" && Number.isFinite(body.durationMin)
      ? Math.max(1, Math.min(180, Math.round(body.durationMin)))
      : undefined;
  const topicIds = cleanStringArray(body.topicIds);
  const columnIds = cleanStringArray(body.columnIds);
  const keywords = cleanStringArray(body.keywords);
  const difficulty = cleanDifficulty(body.difficulty);
  const job = enqueueJob("quiz", {
    subjectId: body.subjectId,
    count,
    title: body.title ?? null,
    durationMin: durationMin ?? null,
    topicIds,
    columnIds,
    keywords,
    difficulty,
  });
  return Response.json({ job }, { status: 202 });
}
