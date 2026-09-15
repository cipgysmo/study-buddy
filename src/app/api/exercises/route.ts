import { generateExercises, listExercises } from "@/lib/practice";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const subjectId = new URL(req.url).searchParams.get("subjectId") ?? undefined;
  return Response.json({ exercises: listExercises(subjectId) });
}

export async function POST(req: Request) {
  let body: { subjectId?: string; count?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (!body.subjectId) return Response.json({ error: "subjectId_required" }, { status: 400 });
  const count = Math.max(1, Math.min(20, body.count ?? 5));
  try {
    const exercises = await generateExercises(body.subjectId, count);
    return Response.json({ exercises }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
