import { getSkillReport } from "@/lib/attempts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const subjectId = params.get("subjectId") ?? params.get("subject") ?? undefined;
  return Response.json(getSkillReport(subjectId));
}
