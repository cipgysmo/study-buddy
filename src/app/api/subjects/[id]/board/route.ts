import { getSubject } from "@/lib/subjects";
import { listBoard } from "@/lib/board";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSubject(id)) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ columns: listBoard(id) });
}