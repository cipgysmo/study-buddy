import {
  createTemplate,
  listTemplates,
  type TemplateItemInput,
} from "@/lib/assignments";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ templates: listTemplates() });
}

export async function POST(req: Request) {
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
    return Response.json(
      { template: createTemplate({ ...body, name: body.name ?? "", items: body.items ?? [] }) },
      { status: 201 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 400 });
  }
}
