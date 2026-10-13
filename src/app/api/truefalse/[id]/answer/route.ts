import { recordAttempt } from "@/lib/attempts";
import { getTrueFalse } from "@/lib/practice";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const item = getTrueFalse(id);
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });

  let body: { answer?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.answer !== "boolean") {
    return Response.json({ error: "answer_required" }, { status: 400 });
  }

  const correct = body.answer === item.is_correct;
  recordAttempt({
    subjectId: item.subject_id,
    kind: "truefalse",
    itemId: id,
    correct,
    score: correct ? 100 : 0,
    payload: { answer: body.answer, explanation: item.explanation },
  });
  return Response.json({ ok: true, correct });
}
