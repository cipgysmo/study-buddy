import { cleanCustomPrompt, cleanDifficulty } from "@/lib/generation";
import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { listTypedExercisesPage } from "@/lib/typed-exercises";
import { cleanStringArray } from "@/lib/request-utils";
import { resolveTopicIds } from "@/lib/topics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const subjectId = params.get("subjectId") ?? params.get("subject") ?? undefined;
  return Response.json(listTypedExercisesPage(params, subjectId));
}

export async function POST(req: Request) {
  let body: {
    subjectId?: string;
    count?: number;
    topicIds?: string[];
    topicNames?: string[];
    columnIds?: string[];
    keywords?: string[];
    difficulty?: string;
    customPrompt?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (!body.subjectId) return Response.json({ error: "subjectId_required" }, { status: 400 });
  const count = Math.max(1, Math.min(20, body.count ?? 5));
  const topicIds = cleanStringArray(body.topicIds).length
    ? cleanStringArray(body.topicIds)
    : resolveTopicIds(body.subjectId, cleanStringArray(body.topicNames));
  const columnIds = cleanStringArray(body.columnIds);
  const keywords = cleanStringArray(body.keywords);
  const difficulty = cleanDifficulty(body.difficulty);
  const customPrompt = cleanCustomPrompt(body.customPrompt);
  const job = enqueueJob("typedexercises", {
    subjectId: body.subjectId,
    count,
    topicIds,
    columnIds,
    keywords,
    difficulty,
    customPrompt,
  });
  return Response.json({ job }, { status: 202 });
}
