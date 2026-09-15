import { deleteTrueFalse, getTrueFalse } from "@/lib/practice";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const item = getTrueFalse(id);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ item });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  deleteTrueFalse(id);
  return Response.json({ ok: true });
}
