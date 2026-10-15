import { createSession, listSessions } from "@/lib/chat";
import { getSubject } from "@/lib/subjects";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ sessions: listSessions() });
}

export async function POST(req: Request) {
  let body: { subjectId?: string | null; title?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const subjectId = body.subjectId ?? null;
  if (subjectId && !getSubject(subjectId)) {
    return Response.json({ error: "subject_not_found" }, { status: 404 });
  }
  const session = createSession(subjectId, body.title);
  return Response.json({ session }, { status: 201 });
}
