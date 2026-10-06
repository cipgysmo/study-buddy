import { listFlashcards } from "@/lib/flashcards";
import { cleanDifficulty } from "@/lib/generation";
import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { cleanStringArray } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const subjectId = url.searchParams.get("subjectId") ?? undefined;
  return Response.json({ flashcards: listFlashcards(subjectId) });
}

export async function POST(req: Request) {
  let body: {
    subjectId?: string;
    count?: number;
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
  const count = Math.max(1, Math.min(50, body.count ?? 10));
  const topicIds = cleanStringArray(body.topicIds);
  const columnIds = cleanStringArray(body.columnIds);
  const keywords = cleanStringArray(body.keywords);
  const difficulty = cleanDifficulty(body.difficulty);
  const job = enqueueJob("flashcards", {
    subjectId: body.subjectId,
    count,
    topicIds,
    columnIds,
    keywords,
    difficulty,
  });
  return Response.json({ job }, { status: 202 });
}
