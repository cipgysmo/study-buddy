import { getDailyChallenges, getLeague, getStars } from "@/lib/gamification";

export const dynamic = "force-dynamic";

export async function GET() {
  const stars = getStars();
  const challenges = getDailyChallenges();
  const league = getLeague(stars.weekly);
  return Response.json({ stars, challenges, league });
}
