import { createBoardCard, getBoardColumn, type BoardCardKind } from "@/lib/board";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const KINDS = new Set<BoardCardKind>(["task", "lesson", "chapter"]);

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getBoardColumn(id)) return Response.json({ error: "not_found" }, { status: 404 });

  let body: { title?: string; kind?: string; note?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const title = body.title?.trim();
  if (!title) return Response.json({ error: "title_required" }, { status: 400 });
  const kind = KINDS.has(body.kind as BoardCardKind) ? (body.kind as BoardCardKind) : "task";
  const card = createBoardCard(id, title, kind, body.note ?? "");
  if (!card) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ card }, { status: 201 });
}