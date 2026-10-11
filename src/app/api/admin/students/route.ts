import { createStudent, listStudents } from "@/lib/assignments";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ students: listStudents() });
}

export async function POST(req: Request) {
  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    return Response.json({ student: createStudent(body.name ?? "") }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 400 });
  }
}
