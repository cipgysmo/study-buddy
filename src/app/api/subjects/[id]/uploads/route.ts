import { getSubject } from "@/lib/subjects";
import { createUploadSession } from "@/lib/uploads";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSubject(id)) {
    return Response.json({ error: "subject_not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const input = body as {
    filename?: unknown;
    mime?: unknown;
    size?: unknown;
    totalChunks?: unknown;
    role?: unknown;
    containerName?: unknown;
  };

  try {
    const session = await createUploadSession({
      subjectId: id,
      filename: String(input.filename ?? ""),
      mime: String(input.mime ?? ""),
      size: Number(input.size ?? 0),
      totalChunks: Number(input.totalChunks ?? 0),
      role: input.role === "exam" ? "exam" : "notes",
      containerName: String(input.containerName ?? ""),
    });
    return Response.json({ upload: session }, { status: 201 });
  } catch (e) {
    const status = e instanceof Error && "status" in e ? Number((e as { status?: unknown }).status) : 500;
    const code = e instanceof Error ? e.message : "upload_failed";
    return Response.json({ error: code }, { status: Number.isFinite(status) ? status : 500 });
  }
}
