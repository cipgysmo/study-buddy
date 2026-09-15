import { dueFlashcards } from "@/lib/flashcards";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const subjectId = url.searchParams.get("subjectId") ?? undefined;
  return Response.json({ flashcards: dueFlashcards(subjectId) });
}
