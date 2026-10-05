import { assignMaterialToColumn, getBoardColumn } from "@/lib/board";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getBoardColumn(id)) return Response.json({ error: "not_found" }, { status: 404 });

  let body: { materialId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const materialId = body.materialId?.trim();
  if (!materialId) return Response.json({ error: "materialId_required" }, { status: 400 });

  const card = assignMaterialToColumn(materialId, id);
  if (!card) return Response.json({ error: "invalid_material" }, { status: 400 });
  return Response.json({ card }, { status: 201 });
}