import { deleteSubject, getSubject } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const subject = getSubject(id);
  if (!subject) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ subject });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  deleteSubject(id);
  return Response.json({ ok: true });
}
