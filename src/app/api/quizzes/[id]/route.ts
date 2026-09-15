import { deleteQuiz, getQuiz, listAttempts, listQuestions } from "@/lib/quizzes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const quiz = getQuiz(id);
  if (!quiz) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ quiz, questions: listQuestions(id), attempts: listAttempts(id) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  deleteQuiz(id);
  return Response.json({ ok: true });
}
