import fs from "node:fs";
import path from "node:path";
import { dataDir } from "@/lib/env";
import { streamFileWithRange } from "@/lib/file-stream";
import { getMaterialPage } from "@/lib/material-pages";
import { getMaterial } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; page: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id, page } = await ctx.params;
  const pageNumber = Number(page);
  if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
    return Response.json({ error: "invalid_page" }, { status: 400 });
  }
  const material = getMaterial(id);
  if (!material) return Response.json({ error: "not_found" }, { status: 404 });

  const p = getMaterialPage(id, pageNumber);
  if (!p?.image_path) return Response.json({ error: "image_not_found" }, { status: 404 });

  const stored = path.resolve(p.image_path);
  const root = path.resolve(dataDir());
  if (!stored.startsWith(root + path.sep) || !fs.existsSync(stored)) {
    return Response.json({ error: "image_not_found" }, { status: 404 });
  }

  return streamFileWithRange(req, stored, "image/jpeg");
}
