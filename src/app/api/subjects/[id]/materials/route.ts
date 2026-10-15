import { assignMaterialToColumn, resolveBoardColumn } from "@/lib/board";
import { maxUploadChunkBytes } from "@/lib/env";
import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { addMaterialPending, getSubject, linkMaterialJob, listMaterials } from "@/lib/subjects";

export const dynamic = "force-dynamic";

const MAX_DIRECT_BODY_BYTES = Math.floor(maxUploadChunkBytes() * 1.5);

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return Response.json({ materials: listMaterials(id) });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSubject(id)) return Response.json({ error: "subject_not_found" }, { status: 404 });
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_DIRECT_BODY_BYTES) {
    return Response.json({ error: "use_chunked_upload" }, { status: 413 });
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "file_required" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const role = form.get("role") === "exam" ? "exam" : "notes";
    const material = addMaterialPending(
      id,
      {
        filename: file.name,
        mime: file.type || "application/octet-stream",
        buffer,
      },
      role
    );
    const job = enqueueJob("ocr", { materialId: material.id });
    linkMaterialJob(material.id, job.id);

    const containerName = String(form.get("containerName") ?? "").trim();
    if (containerName) {
      const column = resolveBoardColumn(id, containerName);
      assignMaterialToColumn(material.id, column.id);
    }

    return Response.json({ material, job }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "upload_failed";
    const status = message.includes("formData") || message.includes("multipart") ? 400 : 500;
    return Response.json({ error: status === 400 ? "invalid_upload" : message }, { status });
  }
}
