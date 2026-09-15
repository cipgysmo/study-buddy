import { deleteFlashcard, getFlashcard } from "@/lib/flashcards";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getFlashcard(id)) return Response.json({ error: "not_found" }, { status: 404 });
  deleteFlashcard(id);
  return Response.json({ ok: true });
}
