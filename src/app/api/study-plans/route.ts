import { createPlan, listPlans } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ plans: listPlans() });
}

export async function POST(req: Request) {
  let body: {
    subjectId?: string;
    title?: string;
    examDate?: string;
    targetGrade?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (!body.subjectId || !body.examDate) {
    return Response.json({ error: "subjectId_and_examDate_required" }, { status: 400 });
  }
  try {
    const plan = await createPlan({
      subjectId: body.subjectId,
      title: body.title?.trim() || "Study plan",
      examDate: body.examDate,
      targetGrade: body.targetGrade?.trim() || null,
    });
    return Response.json({ plan }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
