import { getDb } from "@/lib/db";
import { getJob, retryJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = retryJob(id);
  if (!job) {
    const existing = getJob(id);
    return Response.json(
      { error: existing ? "not_retryable" : "not_found" },
      { status: existing ? 409 : 404 }
    );
  }
  if (job.type === "ocr") {
    const materialId = (JSON.parse(job.payload) as { materialId?: string }).materialId;
    if (materialId) {
      getDb()
        .prepare("UPDATE materials SET status = 'processing', error = NULL WHERE id = ?")
        .run(materialId);
    }
  }
  return Response.json({ job });
}
