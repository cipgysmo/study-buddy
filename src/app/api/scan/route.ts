import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "@/lib/env";
import { enqueueJob } from "@/lib/jobs";
import "@/lib/job-handlers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file_required" }, { status: 400 });
  }
  const mime = file.type || "image/png";
  if (!mime.startsWith("image/")) {
    return Response.json({ error: "image_required" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());

  const id = randomUUID();
  const dir = path.join(dataDir(), "uploads", "_scan");
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(file.name) || ".png";
  const tempPath = path.join(dir, `${id}${ext}`);
  fs.writeFileSync(tempPath, buffer);

  const subjectId = form.get("subjectId");
  const job = enqueueJob("scan", {
    tempPath,
    filename: file.name,
    mime,
    subjectId: typeof subjectId === "string" && subjectId ? subjectId : null,
  });
  return Response.json({ job }, { status: 202 });
}
