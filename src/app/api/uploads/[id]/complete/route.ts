import { assignMaterialToColumn, resolveBoardColumn } from "@/lib/board";
import { enqueueJob, getJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { getMaterial, linkMaterialJob } from "@/lib/subjects";
import { completeUploadSession, createMaterialFromUploadSession } from "@/lib/uploads";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const session = await completeUploadSession(id);
    const existing = getMaterial(session.id);
    if (existing) {
      return Response.json({
        material: existing,
        job: existing.job_id ? getJob(existing.job_id) : null,
      });
    }

    const material = createMaterialFromUploadSession(session);
    const job = enqueueJob("ocr", { materialId: material.id });
    linkMaterialJob(material.id, job.id);

    if (session.container_name) {
      const column = resolveBoardColumn(session.subject_id, session.container_name);
      assignMaterialToColumn(material.id, column.id);
    }

    return Response.json({ material, job }, { status: 201 });
  } catch (e) {
    const status = e instanceof Error && "status" in e ? Number((e as { status?: unknown }).status) : 500;
    const code = e instanceof Error ? e.message : "upload_failed";
    return Response.json({ error: code }, { status: Number.isFinite(status) ? status : 500 });
  }
}
