import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { listQuizzes } from "@/lib/quizzes";

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
  const topicIds = Array.isArray(body.topicIds)
    ? body.topicIds.filter((x): x is string => typeof x === "string")
    : [];
  const job = enqueueJob("quiz", {
    subjectId: body.subjectId,
    count,
    title: body.title ?? null,
    durationMin: durationMin ?? null,
    topicIds,
  });
  return Response.json({ job }, { status: 202 });
}
