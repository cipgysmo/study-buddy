import { setItemDone } from "@/lib/plans";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ itemId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { itemId } = await ctx.params;
  let body: { done?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  setItemDone(itemId, !!body.done);
  return Response.json({ ok: true });
}
