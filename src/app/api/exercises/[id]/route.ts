import { deleteExercise, getExercise } from "@/lib/practice";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const exercise = getExercise(id);
  if (!exercise) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ exercise });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  deleteExercise(id);
  return Response.json({ ok: true });
}
