import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { listExercises } from "@/lib/practice";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const subjectId = new URL(req.url).searchParams.get("subjectId") ?? undefined;
  return Response.json({ exercises: listExercises(subjectId) });
}

export async function POST(req: Request) {
  let body: { subjectId?: string; count?: number; topicIds?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (!body.subjectId) return Response.json({ error: "subjectId_required" }, { status: 400 });
  const count = Math.max(1, Math.min(20, body.count ?? 5));
  const topicIds = Array.isArray(body.topicIds)
    ? body.topicIds.filter((x): x is string => typeof x === "string")
    : [];
  const job = enqueueJob("exercises", { subjectId: body.subjectId, count, topicIds });
  return Response.json({ job }, { status: 202 });
}
