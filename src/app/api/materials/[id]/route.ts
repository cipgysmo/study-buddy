import { deleteMaterial, getMaterial } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getMaterial(id)) return Response.json({ error: "not_found" }, { status: 404 });
  deleteMaterial(id);
  return Response.json({ ok: true });
}
