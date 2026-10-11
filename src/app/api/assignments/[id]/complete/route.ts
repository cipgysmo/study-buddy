import { completeAssignment } from "@/lib/assignments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const assignment = completeAssignment(id);
  if (!assignment) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ assignment });
}
