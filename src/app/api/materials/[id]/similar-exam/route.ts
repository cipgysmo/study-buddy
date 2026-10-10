import { cleanCustomPrompt } from "@/lib/generation";
import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";
import { getMaterial } from "@/lib/subjects";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const m = getMaterial(id);
  if (!m || m.role !== "exam") {
    return Response.json({ error: "not_an_exam" }, { status: 400 });
  }
  let body: { count?: number; durationMin?: number; customPrompt?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const count = Math.max(1, Math.min(30, body.count ?? 10));
  const durationMin =
    typeof body.durationMin === "number" && Number.isFinite(body.durationMin)
      ? Math.max(1, Math.min(180, Math.round(body.durationMin)))
      : Math.min(120, Math.max(10, count * 2));
  const customPrompt = cleanCustomPrompt(body.customPrompt);
  const job = enqueueJob("similarExam", { materialId: id, count, durationMin, customPrompt });
  return Response.json({ job }, { status: 202 });
}
