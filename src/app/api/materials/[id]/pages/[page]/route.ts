import { getMaterialPage } from "@/lib/material-pages";
import { getMaterial } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; page: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id, page } = await ctx.params;
  const pageNumber = Number(page);
  if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
    return Response.json({ error: "invalid_page" }, { status: 400 });
  }
  const material = getMaterial(id);
  if (!material) return Response.json({ error: "not_found" }, { status: 404 });

  const p = getMaterialPage(id, pageNumber);
  if (!p) return Response.json({ error: "page_not_found" }, { status: 404 });

  return Response.json({
    page_number: p.page_number,
    status: p.status,
    error: p.error,
    text: p.text,
    image_url: p.image_path ? `/api/materials/${id}/pages/${p.page_number}/image` : null,
  });
}
