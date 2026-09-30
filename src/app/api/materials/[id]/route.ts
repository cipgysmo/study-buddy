import fs from "node:fs";
import path from "node:path";
import { dataDir } from "@/lib/env";
import { toJpegIfHeic } from "@/lib/ocr";
import { deleteMaterial, getMaterial } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Serve a stored material file. Images are always returned as JPEG/PNG/WebP
 * (HEIC is converted on the fly, since most browsers cannot display it).
 * `?thumb=1` returns a small square JPEG for list thumbnails.
 */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const m = getMaterial(id);
  if (!m) return Response.json({ error: "not_found" }, { status: 404 });

  const stored = path.resolve(m.stored_path);
  const root = path.resolve(dataDir());
  if (!stored.startsWith(root + path.sep) || !fs.existsSync(stored)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  let buffer = fs.readFileSync(stored);
  let mime = m.mime;
  if (m.kind === "image") {
    try {
      const converted = await toJpegIfHeic(buffer, mime);
      buffer = Buffer.from(converted.buffer);
      mime = converted.mimeType;
      if (new URL(req.url).searchParams.get("thumb") === "1") {
        const sharp = (await import("sharp")).default;
        buffer = Buffer.from(
          await sharp(buffer)
            .resize(256, 256, { fit: "cover" })
            .jpeg({ quality: 80 })
            .toBuffer()
        );
      }
    } catch {
      return Response.json({ error: "unreadable_image" }, { status: 500 });
    }
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getMaterial(id)) return Response.json({ error: "not_found" }, { status: 404 });
  deleteMaterial(id);
  return Response.json({ ok: true });
}
