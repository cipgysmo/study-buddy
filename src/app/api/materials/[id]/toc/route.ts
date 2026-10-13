import { getDb } from "@/lib/db";
import { listMaterialTocEntries } from "@/lib/toc";
import { getMaterial } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const material = getMaterial(id);
  if (!material) return Response.json({ error: "not_found" }, { status: 404 });

  const entries = listMaterialTocEntries(id);
  const topicIds = entries.map((e) => e.topic_id).filter((x): x is string => Boolean(x));
  const names = new Map<string, string>();
  if (topicIds.length > 0) {
    const rows = getDb()
      .prepare(`SELECT id, name FROM topics WHERE id IN (${topicIds.map(() => "?").join(",")})`)
      .all(...topicIds) as { id: string; name: string }[];
    for (const row of rows) names.set(row.id, row.name);
  }

  return Response.json({
    entries: entries.map((entry) => ({
      ...entry,
      topic_name: entry.topic_id ? names.get(entry.topic_id) ?? null : null,
    })),
  });
}
