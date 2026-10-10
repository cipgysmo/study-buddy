import { cleanupOldContent, type CleanupType } from "@/lib/cleanup";
import { cleanStringArray } from "@/lib/request-utils";

export const dynamic = "force-dynamic";

const allowedTypes = new Set<CleanupType>([
  "quizzes",
  "mockExams",
  "exercises",
  "truefalse",
  "typed",
  "flashcards",
]);

export async function POST(req: Request) {
  let body: { olderThan?: string; types?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const olderThan = body.olderThan?.trim();
  if (!olderThan || !/^\d{4}-\d{2}-\d{2}$/.test(olderThan)) {
    return Response.json({ error: "olderThan_required" }, { status: 400 });
  }

  const types = cleanStringArray(body.types).filter((x): x is CleanupType =>
    allowedTypes.has(x as CleanupType)
  );
  if (types.length === 0) return Response.json({ error: "types_required" }, { status: 400 });

  return Response.json({ counts: cleanupOldContent(olderThan, types) });
}
