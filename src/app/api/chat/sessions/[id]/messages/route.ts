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

  let body: { content?: string; subjectId?: string | null } = {};
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
  const system = tutorSystemPrompt(languageName, context);

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
        for await (const delta of chatStream({ messages })) {
          full += delta;
          send({ type: "delta", content: delta });
        }
        const saved = addMessage(id, "assistant", full);
        send({ type: "done", messageId: saved.id });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
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
