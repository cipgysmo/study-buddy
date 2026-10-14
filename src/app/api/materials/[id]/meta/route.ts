import { getMaterial } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const m = getMaterial(id);
  if (!m) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({
    material: {
      id: m.id,
      subject_id: m.subject_id,
      filename: m.filename,
      mime: m.mime,
      kind: m.kind,
      page_count: m.page_count,
      status: m.status,
    },
  });
}
