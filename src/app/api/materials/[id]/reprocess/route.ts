import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { getMaterial, linkMaterialJob } from "@/lib/subjects";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const material = getMaterial(id);
  if (!material) return Response.json({ error: "not_found" }, { status: 404 });

  getDb()
    .prepare("UPDATE materials SET status = 'processing', error = NULL WHERE id = ?")
    .run(id);
  const job = enqueueJob("ocr", { materialId: id });
  linkMaterialJob(id, job.id);
  return Response.json({ job }, { status: 201 });
}
