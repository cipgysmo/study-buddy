import { reviewFlashcard } from "@/lib/flashcards";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: { quality?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const card = reviewFlashcard(id, body.quality ?? 0);
  if (!card) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ card });
}
