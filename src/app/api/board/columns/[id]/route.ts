import { deleteBoardColumn, getBoardColumn, renameBoardColumn } from "@/lib/board";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getBoardColumn(id)) return Response.json({ error: "not_found" }, { status: 404 });

  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name) return Response.json({ error: "name_required" }, { status: 400 });

  renameBoardColumn(id, name);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!deleteBoardColumn(id)) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}