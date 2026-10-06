import { cancelJob, getJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = getJob(id);
  if (!job) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ job });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const job = cancelJob(id);
  if (!job) {
    const existing = getJob(id);
    return Response.json(
      { error: existing ? "not_cancellable" : "not_found" },
      { status: existing ? 409 : 404 }
    );
  }
  return Response.json({ job });
}
