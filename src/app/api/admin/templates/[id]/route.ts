import {
  deleteTemplate,
  updateTemplate,
  type TemplateItemInput,
} from "@/lib/assignments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: {
    name?: string;
    description?: string;
    items?: TemplateItemInput[];
  } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const template = updateTemplate(id, body);
    if (!template) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ template });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  deleteTemplate(id);
  return Response.json({ ok: true });
}
