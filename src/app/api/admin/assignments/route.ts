import {
  createAssignment,
  listAssignments,
  type AssignmentType,
} from "@/lib/assignments";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const studentId = url.searchParams.get("studentId") ?? undefined;
  return Response.json({
    assignments: listAssignments({
      status: status === "todo" || status === "done" ? status : undefined,
      studentId,
    }),
  });
}

export async function POST(req: Request) {
  let body: {
    studentId?: string | null;
    subjectId?: string | null;
    type?: AssignmentType;
    title?: string;
    description?: string;
    targetId?: string | null;
    dueAt?: string | null;
    sortOrder?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    return Response.json(
      { assignment: createAssignment({ ...body, title: body.title ?? "" }) },
      { status: 201 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 400 });
  }
}
