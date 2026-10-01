import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-derive-"));
process.env.DATA_DIR = dir;

import { getDb } from "@/lib/db";
import { getDerivedImage, removeDerivedImages } from "@/lib/image-derive";
import type { Material } from "@/lib/subjects";

const subjectId = "subj-1";
const materialId = "mat-1";
let material: Material;

beforeAll(async () => {
  const sharp = (await import("sharp")).default;
  getDb().prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run(subjectId, "Math");
  const png = await sharp({
    create: { width: 400, height: 300, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .png()
    .toBuffer();
  const uploadsDir = path.join(dir, "uploads", subjectId);
  mkdirSync(uploadsDir, { recursive: true });
  const storedPath = path.join(uploadsDir, `${materialId}.png`);
  writeFileSync(storedPath, png);
  getDb()
    .prepare(
      "INSERT INTO materials (id, subject_id, filename, stored_path, mime, kind, size) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(materialId, subjectId, "a.png", storedPath, "image/png", "image", png.length);
  material = getDb().prepare("SELECT * FROM materials WHERE id = ?").get(materialId) as Material;
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("getDerivedImage", () => {
  it("serves a non-HEIC full image directly without a cache entry", async () => {
    const { buffer, mime } = await getDerivedImage(material, false);
    expect(mime).toBe("image/png");
    expect(buffer.length).toBe(material.size);
    expect(existsSync(path.join(dir, "derived", subjectId, `${materialId}.jpg`))).toBe(false);
  });

  it("creates a cached thumbnail and reuses it", async () => {
    const first = await getDerivedImage(material, true);
    expect(first.mime).toBe("image/jpeg");
    const thumbPath = path.join(dir, "derived", subjectId, `${materialId}.thumb.jpg`);
    expect(existsSync(thumbPath)).toBe(true);
    const second = await getDerivedImage(material, true);
    expect(second.buffer.equals(first.buffer)).toBe(true);
  });

  it("removes derived images on cleanup", () => {
    removeDerivedImages(subjectId, materialId);
    expect(existsSync(path.join(dir, "derived", subjectId, `${materialId}.thumb.jpg`))).toBe(false);
  });
});
