import { generateQuiz, listQuizzes } from "@/lib/quizzes";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ quizzes: listQuizzes() });
}

export async function POST(req: Request) {
  let body: { subjectId?: string; count?: number; title?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (!body.subjectId) return Response.json({ error: "subjectId_required" }, { status: 400 });
  const count = Math.max(1, Math.min(30, body.count ?? 5));
  try {
    const quiz = await generateQuiz(body.subjectId, count, body.title);
    return Response.json({ quiz }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
