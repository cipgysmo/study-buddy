import { deleteBoardCard } from "@/lib/board";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!deleteBoardCard(id)) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}