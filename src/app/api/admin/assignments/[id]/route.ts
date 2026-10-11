import {
  deleteAssignment,
  updateAssignment,
  type AssignmentStatus,
  type AssignmentType,
} from "@/lib/assignments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: {
    studentId?: string | null;
    subjectId?: string | null;
    type?: AssignmentType;
    title?: string;
    description?: string;
    targetId?: string | null;
    dueAt?: string | null;
    status?: AssignmentStatus;
    sortOrder?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const assignment = updateAssignment(id, body);
    if (!assignment) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ assignment });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  deleteAssignment(id);
  return Response.json({ ok: true });
}
