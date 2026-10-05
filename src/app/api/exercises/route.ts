import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { listExercises } from "@/lib/practice";
import { cleanStringArray } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const subjectId = new URL(req.url).searchParams.get("subjectId") ?? undefined;
  return Response.json({ exercises: listExercises(subjectId) });
}

export async function POST(req: Request) {
  let body: {
    subjectId?: string;
    count?: number;
    topicIds?: string[];
    columnIds?: string[];
    keywords?: string[];
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
  const job = enqueueJob("exercises", { subjectId: body.subjectId, count, topicIds, columnIds, keywords });
  return Response.json({ job }, { status: 202 });
}
