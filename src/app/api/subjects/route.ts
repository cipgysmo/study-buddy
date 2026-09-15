import { createSubject, listSubjects } from "@/lib/subjects";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ subjects: listSubjects() });
}

export async function POST(req: Request) {
  let body: { name?: string; color?: string; icon?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "name_required" }, { status: 400 });
  }
  const subject = createSubject(name, body.color, body.icon);
  return Response.json({ subject }, { status: 201 });
}
