import { listMaterialPageSummaries } from "@/lib/material-pages";
import { getMaterial } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const material = getMaterial(id);
  if (!material) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({
    pageCount: material.page_count,
    pages: listMaterialPageSummaries(id),
  });
}
