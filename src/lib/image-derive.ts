import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./env";
import { toJpegIfHeic } from "./ocr";
import type { Material } from "./subjects";

function isHeic(mime: string): boolean {
  return mime === "image/heic" || mime === "image/heif";
}

function derivedDir(subjectId: string): string {
  return path.join(dataDir(), "derived", subjectId);
}

/**
 * Return the bytes + mime for a material's image, backed by a per-material disk
 * cache so HEIC decode / thumbnail resize happen once, not on every request.
 *
 * - A non-HEIC full image needs no conversion and is served straight from the
 *   stored file (no re-encode, no cache entry).
 * - A HEIC full image is decoded to JPEG and cached as `<id>.jpg`.
 * - `thumb` returns a cached 256x256 cover JPEG at `<id>.thumb.jpg`.
 *
 * The first call for a given image pays the decode/resize cost; every call
 * after is a plain disk read.
 */
export async function getDerivedImage(
  m: Material,
  thumb: boolean
): Promise<{ buffer: Buffer; mime: string }> {
  const heic = isHeic(m.mime);

  if (!thumb && !heic) {
    return { buffer: fs.readFileSync(m.stored_path), mime: m.mime };
  }

  const dir = derivedDir(m.subject_id);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, thumb ? `${m.id}.thumb.jpg` : `${m.id}.jpg`);

  if (fs.existsSync(target)) {
    return { buffer: fs.readFileSync(target), mime: "image/jpeg" };
  }

  const source = fs.readFileSync(m.stored_path);
  let buffer = heic ? Buffer.from((await toJpegIfHeic(source, m.mime)).buffer) : source;
  if (thumb) {
    const sharp = (await import("sharp")).default;
    buffer = Buffer.from(
      await sharp(buffer).resize(256, 256, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer()
    );
  }

  // Atomic write: temp file + rename, so a concurrent request never reads a
  // half-written cache entry.
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, target);

  return { buffer, mime: "image/jpeg" };
}

/** Remove a single material's cached derived images (called on delete). */
export function removeDerivedImages(subjectId: string, materialId: string): void {
  for (const name of [`${materialId}.jpg`, `${materialId}.thumb.jpg`]) {
    try {
      fs.rmSync(path.join(derivedDir(subjectId), name), { force: true });
    } catch {
      /* ignore */
    }
  }
}

/** Remove every cached derived image for a subject (called on subject delete). */
export function removeDerivedDir(subjectId: string): void {
  try {
    fs.rmSync(derivedDir(subjectId), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
