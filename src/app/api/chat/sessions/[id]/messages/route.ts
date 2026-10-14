import { LANGUAGES } from "@/i18n/languages";
import {
  addMessage,
  getAttachment,
  getSession,
  listMessages,
  setSessionSubject,
  setSessionTitle,
} from "@/lib/chat";
import { attachmentUrl, buildAttachmentParts, toMeta } from "@/lib/chat-attachments";
import { buildSubjectContext } from "@/lib/context";
import { resolveLocale } from "@/lib/locale";
import { chatStream, type ChatMessage as LlmMessage } from "@/lib/llm";
import { getStudentName } from "@/lib/profile";
import { tutorSystemPrompt } from "@/lib/prompts/tutor";
import { topicNames } from "@/lib/topics";

export const dynamic = "force-dynamic";

// Keep the local model fast: cap how much history and how many note characters
// go into each turn.
const MAX_HISTORY_MESSAGES = 24;
const CHAT_CONTEXT_CHARS = 16000;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSession(id)) return Response.json({ error: "not_found" }, { status: 404 });
  const messages = listMessages(id).map((m) => ({
    ...m,
    attachments: m.attachments?.map((a) => ({ ...a, url: attachmentUrl(a.id) })) ?? null,
  }));
  return Response.json({ messages });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const session = getSession(id);
  if (!session) return Response.json({ error: "not_found" }, { status: 404 });

  let body: {
    content?: string;
    subjectId?: string | null;
    topicIds?: string[];
    attachmentIds?: string[];
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const content = body.content?.trim() ?? "";
  const attachmentIds = Array.isArray(body.attachmentIds)
    ? body.attachmentIds.filter((x): x is string => typeof x === "string")
    : [];
  if (!content && attachmentIds.length === 0) {
    return Response.json({ error: "content_required" }, { status: 400 });
  }

  const subjectId = body.subjectId ?? session.subject_id;
  if (body.subjectId !== undefined) setSessionSubject(id, subjectId);
  if (session.title === "New chat") setSessionTitle(id, content.slice(0, 40));

  const topicIds = Array.isArray(body.topicIds)
    ? body.topicIds.filter((x): x is string => typeof x === "string")
    : [];

  const locale = await resolveLocale();
  const languageName = LANGUAGES.find((l) => l.code === locale)?.name ?? locale;
  let context: string | undefined;
  if (subjectId) {
    try {
      context = buildSubjectContext(subjectId, topicIds, CHAT_CONTEXT_CHARS);
    } catch {
      context = undefined;
    }
  }
  const system = tutorSystemPrompt(languageName, context, topicNames(topicIds), getStudentName());

  const metas = attachmentIds
    .map((aid) => getAttachment(aid))
    .filter((a): a is NonNullable<typeof a> => !!a && a.session_id === id)
    .map(toMeta);
  const { parts: imageParts, pdfNote } = await buildAttachmentParts(metas);

  let textForModel = content;
  if (pdfNote) textForModel = (textForModel ? textForModel + "\n\n" : "") + pdfNote;

  const history = listMessages(id).slice(-MAX_HISTORY_MESSAGES);
  const userContent: LlmMessage["content"] = imageParts.length
    ? [{ type: "text", text: textForModel || "(see attached image)" }, ...imageParts]
    : textForModel;

  const messages: LlmMessage[] = [
    { role: "system", content: system },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userContent },
  ];

  addMessage(id, "user", content, metas.length ? metas : undefined);

  const encoder = new TextEncoder();
  let full = "";
  let persisted = false;
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
        persisted = true;
        send({ type: "done", messageId: saved.id });
      } catch (e) {
        // Client stopped the stream: keep any partial answer, report nothing.
        if (req.signal.aborted) {
          if (full && !persisted) addMessage(id, "assistant", full);
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
