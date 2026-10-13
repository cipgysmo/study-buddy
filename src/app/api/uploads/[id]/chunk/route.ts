import { appendUploadChunk } from "@/lib/uploads";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const chunkIndex = Number(req.headers.get("x-upload-chunk-index"));
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return Response.json({ error: "chunk_index_required" }, { status: 400 });
  }

  try {
    const body = await req.arrayBuffer();
    const session = await appendUploadChunk(id, chunkIndex, Buffer.from(body));
    return Response.json({ upload: session });
  } catch (e) {
    const status = e instanceof Error && "status" in e ? Number((e as { status?: unknown }).status) : 500;
    const code = e instanceof Error ? e.message : "upload_failed";
    return Response.json({ error: code }, { status: Number.isFinite(status) ? status : 500 });
  }
}
