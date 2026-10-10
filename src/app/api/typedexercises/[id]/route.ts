import { deleteTypedExercise } from "@/lib/typed-exercises";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  deleteTypedExercise(id);
  return Response.json({ ok: true });
}
