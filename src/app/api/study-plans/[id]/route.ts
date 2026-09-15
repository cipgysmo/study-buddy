import { deletePlan, getPlan, listPlanItems } from "@/lib/plans";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const plan = getPlan(id);
  if (!plan) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ plan, items: listPlanItems(id) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  deletePlan(id);
  return Response.json({ ok: true });
}
