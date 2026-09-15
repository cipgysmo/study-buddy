import { addMaterial, listMaterials } from "@/lib/subjects";

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
  const material = await addMaterial(id, {
    filename: file.name,
    mime: file.type || "application/octet-stream",
    buffer,
  });
  return Response.json({ material }, { status: 201 });
}
