import { getSubject } from "@/lib/subjects";
import { createTopic, listTopics } from "@/lib/topics";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSubject(id)) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ topics: listTopics(id) });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getSubject(id)) return Response.json({ error: "not_found" }, { status: 404 });
  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const name = body.name?.trim();
  if (!name) return Response.json({ error: "name_required" }, { status: 400 });
  const topic = createTopic(id, name);
  return Response.json({ topic }, { status: 201 });
}
