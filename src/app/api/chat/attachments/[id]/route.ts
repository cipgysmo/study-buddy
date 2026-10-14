import fs from "node:fs";
import { getAttachment } from "@/lib/chat";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const row = getAttachment(id);
  if (!row || !fs.existsSync(row.path)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const buf = fs.readFileSync(row.path);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(buf.length),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
