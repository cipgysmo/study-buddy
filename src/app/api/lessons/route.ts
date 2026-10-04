import { listLessons } from "@/lib/lessons";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ lessons: listLessons() });
}
