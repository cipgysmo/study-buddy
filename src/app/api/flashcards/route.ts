import { generateFlashcards, listFlashcards } from "@/lib/flashcards";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const subjectId = url.searchParams.get("subjectId") ?? undefined;
  return Response.json({ flashcards: listFlashcards(subjectId) });
}

export async function POST(req: Request) {
  let body: { subjectId?: string; count?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (!body.subjectId) return Response.json({ error: "subjectId_required" }, { status: 400 });
  const count = Math.max(1, Math.min(50, body.count ?? 10));
  try {
    const flashcards = await generateFlashcards(body.subjectId, count);
    return Response.json({ flashcards }, { status: 201 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
