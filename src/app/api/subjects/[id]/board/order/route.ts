import { getSubject } from "@/lib/subjects";
import { saveBoardOrder, type BoardOrderInput } from "@/lib/board";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSubject(id)) return Response.json({ error: "not_found" }, { status: 404 });

  let body: { columns?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(body.columns)) {
    return Response.json({ error: "columns_required" }, { status: 400 });
  }

  const columns: BoardOrderInput[] = [];
  for (const raw of body.columns) {
    if (!raw || typeof raw !== "object") {
      return Response.json({ error: "invalid_column" }, { status: 400 });
    }
    const column = raw as { id?: unknown; cards?: unknown };
    if (typeof column.id !== "string" || !Array.isArray(column.cards)) {
      return Response.json({ error: "invalid_column" }, { status: 400 });
    }
    const cards: { id: string }[] = [];
    for (const rawCard of column.cards) {
      if (!rawCard || typeof rawCard !== "object") {
        return Response.json({ error: "invalid_card" }, { status: 400 });
      }
      const card = rawCard as { id?: unknown };
      if (typeof card.id !== "string") {
        return Response.json({ error: "invalid_card" }, { status: 400 });
      }
      cards.push({ id: card.id });
    }
    columns.push({ id: column.id, cards });
  }

  try {
    saveBoardOrder(id, columns);
  } catch {
    return Response.json({ error: "invalid_board" }, { status: 400 });
  }
  return Response.json({ ok: true });
}