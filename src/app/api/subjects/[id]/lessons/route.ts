import { getSubject } from "@/lib/subjects";
import { createLesson, setLessonJob } from "@/lib/lessons";
import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSubject(id)) return Response.json({ error: "not_found" }, { status: 404 });

  let body: { topicIds?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const topicIds = Array.isArray(body.topicIds)
    ? body.topicIds.filter((x): x is string => typeof x === "string")
    : [];

  const lesson = createLesson(id, topicIds);
  const job = enqueueJob("lesson", { lessonId: lesson.id });
  setLessonJob(lesson.id, job.id);
  return Response.json({ lesson, job }, { status: 202 });
}
