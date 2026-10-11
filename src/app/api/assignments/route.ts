import { listAssignments } from "@/lib/assignments";

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
