import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir, maxUploadBytes } from "@/lib/env";
import { enqueueJob } from "@/lib/jobs";
import { getSubject } from "@/lib/subjects";
import "@/lib/job-handlers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid_upload" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file_required" }, { status: 400 });
  }
  const mime = file.type || "image/png";
  if (!mime.startsWith("image/")) {
    return Response.json({ error: "image_required" }, { status: 400 });
  }
  if (file.size > maxUploadBytes()) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());

  const subjectIdRaw = form.get("subjectId");
  const subjectId = typeof subjectIdRaw === "string" && subjectIdRaw ? subjectIdRaw : null;
  if (subjectId && !getSubject(subjectId)) {
    return Response.json({ error: "subject_not_found" }, { status: 404 });
  }

  const id = randomUUID();
  const dir = path.join(dataDir(), "uploads", "_scan");
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(file.name) || ".png";
  const tempPath = path.join(dir, `${id}${ext}`);
  fs.writeFileSync(tempPath, buffer);

  const job = enqueueJob("scan", {
    tempPath,
    filename: file.name,
    mime,
    subjectId,
  });
  return Response.json({ job }, { status: 202 });
}
