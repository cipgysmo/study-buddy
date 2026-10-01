import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { getSubject } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Re-derive topics from the content of all of a subject's note materials. */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSubject(id)) return Response.json({ error: "not_found" }, { status: 404 });
  const job = enqueueJob("retag", { subjectId: id });
  return Response.json({ job }, { status: 202 });
}
