import { achievementIcons, syncAchievements } from "@/lib/achievements";
import { getQuiz, gradeQuiz } from "@/lib/quizzes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!getQuiz(id)) return Response.json({ error: "not_found" }, { status: 404 });
  let body: { answers?: Record<string, number> } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }
  const result = gradeQuiz(id, body.answers ?? {});
  const newAchievements = achievementIcons(syncAchievements());
  return Response.json({ ...result, newAchievements });
}
