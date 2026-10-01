import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { listPlans } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ plans: listPlans() });
}

export async function POST(req: Request) {
  let body: {
    subjectId?: string;
    title?: string;
    examDate?: string;
    targetGrade?: string;
    topicIds?: string[];
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (!body.subjectId || !body.examDate) {
    return Response.json({ error: "subjectId_and_examDate_required" }, { status: 400 });
  }
  const topicIds = Array.isArray(body.topicIds)
    ? body.topicIds.filter((x): x is string => typeof x === "string")
    : [];
  const job = enqueueJob("plan", {
    subjectId: body.subjectId,
    title: body.title?.trim() || "Study plan",
    examDate: body.examDate,
    targetGrade: body.targetGrade?.trim() || null,
    topicIds,
  });
  return Response.json({ job }, { status: 202 });
}
