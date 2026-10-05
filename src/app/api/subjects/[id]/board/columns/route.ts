import { getSubject } from "@/lib/subjects";
import { createBoardColumn } from "@/lib/board";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSubject(id)) return Response.json({ error: "not_found" }, { status: 404 });

  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const name = body.name?.trim();
  if (!name) return Response.json({ error: "name_required" }, { status: 400 });

  return Response.json({ column: createBoardColumn(id, name) }, { status: 201 });
}