import { ocrImage } from "@/lib/ocr";
import { addMaterial } from "@/lib/subjects";

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

  let text: string;
  try {
    text = await ocrImage(buffer, mime);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  const subjectId = form.get("subjectId");
  let material = null;
  if (typeof subjectId === "string" && subjectId) {
    material = await addMaterial(subjectId, { filename: file.name, mime, buffer }, text);
  }

  return Response.json({ text, material }, { status: 201 });
}
