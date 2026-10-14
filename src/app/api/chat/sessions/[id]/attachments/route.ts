import { createAttachment, getAttachment, getSession } from "@/lib/chat";
import {
  attachmentUrl,
  classifyAttachment,
  maxBytesFor,
  saveAttachmentFile,
  toMeta,
} from "@/lib/chat-attachments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSession(id)) return Response.json({ error: "not_found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file_required" }, { status: 400 });
  }
  const mime = file.type || "application/octet-stream";
  const kind = classifyAttachment(mime);
  if (!kind) return Response.json({ error: "unsupported_type" }, { status: 415 });
  if (file.size > maxBytesFor(kind)) return Response.json({ error: "too_large" }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const draft = createAttachment(id, kind, file.name || "attachment", mime, "");
  const filePath = saveAttachmentFile(id, draft.id, mime, buffer);
  const { getDb } = await import("@/lib/db");
  getDb().prepare("UPDATE chat_attachments SET path = ? WHERE id = ?").run(filePath, draft.id);

  const row = getAttachment(draft.id)!;
  return Response.json(
    { attachment: { ...toMeta(row), url: attachmentUrl(row.id) } },
    { status: 201 }
  );
}
