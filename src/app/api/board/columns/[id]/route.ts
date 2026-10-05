import {
  deleteBoardColumn,
  getBoardColumn,
  moveBoardColumnToSubject,
  renameBoardColumn,
} from "@/lib/board";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getBoardColumn(id)) return Response.json({ error: "not_found" }, { status: 404 });

  let body: { name?: string; subjectId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = body.name?.trim();
  const subjectId = body.subjectId?.trim();
  if (!name && !subjectId) return Response.json({ error: "name_or_subjectId_required" }, { status: 400 });

  if (name) renameBoardColumn(id, name);
  if (subjectId && !moveBoardColumnToSubject(id, subjectId)) {
    return Response.json({ error: "invalid_subject" }, { status: 400 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!deleteBoardColumn(id)) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}