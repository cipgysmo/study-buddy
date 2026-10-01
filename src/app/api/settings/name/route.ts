import { getStudentName, setStudentName } from "@/lib/profile";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ name: getStudentName() });
}

export async function POST(req: Request) {
  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  if (typeof body.name !== "string") {
    return Response.json({ error: "name_required" }, { status: 400 });
  }
  const name = setStudentName(body.name);
  return Response.json({ ok: true, name });
}
