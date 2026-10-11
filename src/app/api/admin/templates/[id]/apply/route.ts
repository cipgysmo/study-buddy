import { applyTemplate } from "@/lib/assignments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: { studentId?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  try {
    return Response.json({ assignments: applyTemplate(id, body.studentId ?? null) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 400 });
  }
}
