import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { cleanCustomPrompt, cleanDifficulty } from "@/lib/generation";
import { listTrueFalse } from "@/lib/practice";
import { cleanStringArray } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const subjectId = new URL(req.url).searchParams.get("subjectId") ?? undefined;
  return Response.json({ items: listTrueFalse(subjectId) });
}

export async function POST(req: Request) {
  let body: {
    subjectId?: string;
    count?: number;
    topicIds?: string[];
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
  const topicIds = cleanStringArray(body.topicIds);
  const columnIds = cleanStringArray(body.columnIds);
  const keywords = cleanStringArray(body.keywords);
  const difficulty = cleanDifficulty(body.difficulty);
  const customPrompt = cleanCustomPrompt(body.customPrompt);
  const job = enqueueJob("truefalse", {
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
