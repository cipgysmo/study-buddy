import { getProgress } from "@/lib/progress";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getProgress());
}
