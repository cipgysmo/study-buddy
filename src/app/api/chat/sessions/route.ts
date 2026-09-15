import { createSession, listSessions } from "@/lib/chat";

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
  const session = createSession(body.subjectId ?? null, body.title);
  return Response.json({ session }, { status: 201 });
}
