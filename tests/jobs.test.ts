import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "sb-jobs-"));
process.env.DATA_DIR = dir;

import {
  enqueueJob,
  getJob,
  listActiveJobs,
  registerJobHandler,
  retryJob,
  type Job,
} from "@/lib/jobs";

// Keys in this set make the handler throw exactly once (first attempt).
const failOnce = new Set<string>();

beforeAll(() => {
  registerJobHandler("ocr", async ({ payload }) => {
    const key = String(payload.key ?? "");
    if (failOnce.has(key)) {
      failOnce.delete(key);
      throw new Error("boom");
    }
    return `result:${payload.value ?? ""}`;
  });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function waitFor(id: string, timeoutMs = 5000): Promise<Job> {
  const start = Date.now();
  for (;;) {
    const job = getJob(id);
    if (!job) throw new Error("job disappeared");
    if (job.status === "done" || job.status === "failed") return job;
    if (Date.now() - start > timeoutMs) throw new Error(`job ${id} stuck in ${job.status}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("job engine", () => {
  it("runs a job and stores its result", async () => {
    const job = enqueueJob("ocr", { value: "42" });
    // The worker may have already claimed the job by the time enqueue returns.
    expect(["pending", "running"]).toContain(job.status);
    const done = await waitFor(job.id);
    expect(done.status).toBe("done");
    expect(done.result).toBe("result:42");
    expect(done.error).toBeNull();
    expect(done.started_at).not.toBeNull();
    expect(done.finished_at).not.toBeNull();
  });

  it("marks a job failed with the handler's error message", async () => {
    failOnce.add("f1");
    const job = enqueueJob("ocr", { key: "f1" });
    const failed = await waitFor(job.id);
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("boom");
  });

  it("retries a failed job until it succeeds", async () => {
    failOnce.add("f2");
    const job = enqueueJob("ocr", { key: "f2" });
    await waitFor(job.id);
    const retried = retryJob(job.id);
    expect(["pending", "running"]).toContain(retried?.status);
    const done = await waitFor(job.id);
    expect(done.status).toBe("done");
    expect(done.error).toBeNull();
  });

  it("refuses to retry a job that is not failed", async () => {
    const job = enqueueJob("ocr", { value: "x" });
    await waitFor(job.id);
    expect(retryJob(job.id)).toBeNull();
    expect(retryJob("no-such-job")).toBeNull();
  });

  it("processes at most one job at a time, in FIFO order", async () => {
    let running = 0;
    let maxRunning = 0;
    const order: string[] = [];
    registerJobHandler("flashcards", async ({ payload }) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 20));
      order.push(String(payload.tag));
      running--;
      return null;
    });

    const jobs = ["a", "b", "c"].map((tag) => enqueueJob("flashcards", { tag }));
    for (const j of jobs) await waitFor(j.id);

    expect(maxRunning).toBe(1);
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("listActiveJobs reports only pending/running jobs", async () => {
    expect(listActiveJobs().length).toBe(0);
    registerJobHandler(
      "scan",
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        return null;
      }
    );
    const job = enqueueJob("scan", {});
    expect(listActiveJobs().map((j) => j.id)).toContain(job.id);
    await waitFor(job.id);
    expect(listActiveJobs().map((j) => j.id)).not.toContain(job.id);
  });
});
