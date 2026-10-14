import { setArenaWinner } from "@/lib/arena";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: { winner?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const winner = body.winner;
  if (winner !== "a" && winner !== "b" && winner !== "tie") {
    return Response.json({ error: "invalid_winner" }, { status: 400 });
  }
  setArenaWinner(id, winner);
  return Response.json({ ok: true });
}
