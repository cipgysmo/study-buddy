import { listExamQuestions } from "@/lib/exams";
import { getMaterial } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const m = getMaterial(id);
  if (!m) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ questions: listExamQuestions(id) });
}
