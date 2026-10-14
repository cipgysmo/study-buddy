import { runArena } from "@/lib/arena";
import { buildSubjectContext } from "@/lib/context";
import { LANGUAGES } from "@/i18n/languages";
import { resolveLocale } from "@/lib/locale";
import { tutorSystemPrompt } from "@/lib/prompts/tutor";
import { topicNames } from "@/lib/topics";
import { getStudentName } from "@/lib/profile";
import type { ChatMessage } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    content?: string;
    subjectId?: string | null;
    topicIds?: string[];
    modelA?: string;
    modelB?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const content = body.content?.trim();
  const modelA = body.modelA?.trim();
  const modelB = body.modelB?.trim();
  if (!content || !modelA || !modelB) {
    return Response.json({ error: "content_and_models_required" }, { status: 400 });
  }

  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
  let context: string | undefined;
  if (body.subjectId) {
    try {
      context = buildSubjectContext(body.subjectId, body.topicIds ?? [], 16000);
    } catch {
      context = undefined;
    }
  }
  const system = tutorSystemPrompt(
    languageName,
    context,
    topicNames(body.topicIds ?? []),
    getStudentName()
  );
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content },
  ];

  const result = await runArena(messages, modelA, modelB, { maxTokens: 1200 });
  return Response.json({ result });
}

export async function GET() {
  const { listArenaResults } = await import("@/lib/arena");
  return Response.json({ results: listArenaResults(20) });
}
