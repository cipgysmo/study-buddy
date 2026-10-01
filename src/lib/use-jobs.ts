"use client";

import { useEffect, useRef, useState } from "react";

export interface JobInfo {
  id: string;
  type: string;
  status: "pending" | "running" | "done" | "failed";
  error: string | null;
  result: string | null;
}

/**
 * Poll a single job every 2s until it reaches a terminal state.
 * `onSettled` fires (from the poll callback) with the final job.
 */
export function useJob(jobId: string | null, onSettled?: (job: JobInfo) => void): JobInfo | null {
  const [state, setState] = useState<{ key: string | null; job: JobInfo | null }>({
    key: null,
    job: null,
  });
  const onSettledRef = useRef(onSettled);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function tick() {
      try {
        const r = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { job: JobInfo };
        if (stop) return;
        setState({ key: jobId, job: d.job });
        if (d.job.status === "done" || d.job.status === "failed") {
          if (timer) clearInterval(timer);
          onSettledRef.current?.(d.job);
        }
      } catch {
        /* transient network error; retried on the next tick */
      }
    }

    void tick();
    timer = setInterval(() => void tick(), 2000);
    return () => {
      stop = true;
      if (timer) clearInterval(timer);
    };
  }, [jobId]);

  return state.key === jobId ? state.job : null;
}
