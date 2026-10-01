import { deleteTopic, getTopic } from "@/lib/topics";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getTopic(id)) return Response.json({ error: "not_found" }, { status: 404 });
  deleteTopic(id);
  return Response.json({ ok: true });
}
