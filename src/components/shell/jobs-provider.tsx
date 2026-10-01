"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface ActiveJob {
  id: string;
  type: string;
}

const JobsContext = createContext<ActiveJob[]>([]);

/** Polls /api/jobs every 2s so the whole app knows what the background worker is doing. */
export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<ActiveJob[]>([]);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const r = await fetch("/api/jobs", { cache: "no-store" });
        const d = (await r.json()) as { jobs: ActiveJob[] };
        if (!stop) setActive(d.jobs);
      } catch {
        /* ignore */
      }
    }
    void poll();
    const iv = setInterval(() => void poll(), 2000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, []);

  return <JobsContext.Provider value={active}>{children}</JobsContext.Provider>;
}

export function useActiveJobs(): ActiveJob[] {
  return useContext(JobsContext);
}
