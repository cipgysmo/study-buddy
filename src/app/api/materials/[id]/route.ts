import fs from "node:fs";
import path from "node:path";
import { dataDir } from "@/lib/env";
import { getDerivedImage } from "@/lib/image-derive";
import { deleteMaterial, getMaterial } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Serve a stored material file. Images are returned as JPEG/PNG/WebP (HEIC is
 * converted, since most browsers cannot display it) and backed by a disk cache
 * so the conversion/resize happens once, not per request. `?thumb=1` returns a
 * small square JPEG for list thumbnails.
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

  const thumb = new URL(req.url).searchParams.get("thumb") === "1";
  let buffer: Buffer;
  let mime: string;
  if (m.kind === "image") {
    try {
      ({ buffer, mime } = await getDerivedImage(m, thumb));
    } catch {
      return Response.json({ error: "unreadable_image" }, { status: 500 });
    }
  } else {
    buffer = fs.readFileSync(stored);
    mime = m.mime;
  }

  return new Response(buffer as BodyInit, {
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
