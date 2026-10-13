import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-uploads-"));
process.env.DATA_DIR = dir;

import { getDb } from "@/lib/db";
import { getMaterial } from "@/lib/subjects";
import {
  appendUploadChunk,
  completeUploadSession,
  createMaterialFromUploadSession,
  createUploadSession,
} from "@/lib/uploads";

let subjectId: string;

beforeAll(() => {
  getDb().prepare("INSERT INTO subjects (id, name) VALUES (?, ?)").run("subj-1", "Math");
  subjectId = "subj-1";
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("chunked uploads", () => {
  it("assembles chunks and creates a material from the completed upload", async () => {
    const first = Buffer.from("hello ");
    const second = Buffer.from("world");
    const session = await createUploadSession({
      subjectId,
      filename: "manual.pdf",
      mime: "application/pdf",
      size: first.length + second.length,
      totalChunks: 2,
      role: "notes",
      containerName: "",
    });

    await appendUploadChunk(session.id, 0, first);
    await appendUploadChunk(session.id, 1, second);
    const completed = await completeUploadSession(session.id);
    expect(completed.status).toBe("complete");

    const material = createMaterialFromUploadSession(completed);
    expect(material.id).toBe(session.id);
    expect(material.size).toBe(first.length + second.length);
    expect(getMaterial(material.id)?.filename).toBe("manual.pdf");
  });
});
