import { LANGUAGES } from "@/i18n/languages";
import {
  addMessage,
  getSession,
  listMessages,
  setSessionSubject,
  setSessionTitle,
} from "@/lib/chat";
import { buildSubjectContext } from "@/lib/context";
import { resolveLocale } from "@/lib/locale";
import { chatStream, type ChatMessage as LlmMessage } from "@/lib/llm";
import { tutorSystemPrompt } from "@/lib/prompts/tutor";
import { topicNames } from "@/lib/topics";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSession(id)) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ messages: listMessages(id) });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = getSession(id);
  if (!session) return Response.json({ error: "not_found" }, { status: 404 });

  let body: { content?: string; subjectId?: string | null; topicIds?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const content = body.content?.trim();
  if (!content) return Response.json({ error: "content_required" }, { status: 400 });

  const subjectId = body.subjectId ?? session.subject_id;
  if (body.subjectId !== undefined) setSessionSubject(id, subjectId);
  if (session.title === "New chat") setSessionTitle(id, content.slice(0, 40));

  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
  const context = subjectId ? buildSubjectContext(subjectId) : undefined;
  const topicIds = Array.isArray(body.topicIds)
    ? body.topicIds.filter((x): x is string => typeof x === "string")
    : [];
  const system = tutorSystemPrompt(languageName, context, topicNames(topicIds));

  const history = listMessages(id);
  const messages: LlmMessage[] = [
    { role: "system", content: system },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content },
  ];

  addMessage(id, "user", content);

  const encoder = new TextEncoder();
  let full = "";
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const delta of chatStream({ messages, signal: req.signal })) {
          full += delta;
          send({ type: "delta", content: delta });
        }
        const saved = addMessage(id, "assistant", full);
        send({ type: "done", messageId: saved.id });
      } catch (e) {
        // Client stopped the stream: keep any partial answer, report nothing.
        if (req.signal.aborted) {
          if (full) addMessage(id, "assistant", full);
        } else {
          send({ type: "error", message: e instanceof Error ? e.message : String(e) });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
