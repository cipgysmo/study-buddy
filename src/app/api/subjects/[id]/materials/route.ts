import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { addMaterialPending, linkMaterialJob, listMaterials } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return Response.json({ materials: listMaterials(id) });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
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
  return Response.json({ material, job }, { status: 201 });
}
