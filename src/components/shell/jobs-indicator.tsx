"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/spinner";
import { useActiveJobs } from "./jobs-provider";

export function JobsIndicator({ variant = "list" }: { variant?: "badge" | "list" }) {
  const t = useTranslations("Common");
  const tj = useTranslations("Jobs");
  const active = useActiveJobs();
  const [hidden, setHidden] = useState<string[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const visible = active.filter((job) => !hidden.includes(job.id));
  if (visible.length === 0) return null;

  async function cancel(id: string) {
    if (busy[id]) return;
    setBusy((prev) => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      setHidden((prev) => [...prev, id]);
    } finally {
      setBusy((prev) => ({ ...prev, [id]: false }));
    }
  }

  if (variant === "badge") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
        <Spinner className="h-3 w-3" />
        {t("inProgress", { count: visible.length })}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      {visible.map((job) => (
        <div
          key={job.id}
          className="group flex items-center gap-2 rounded-lg bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"
        >
          <Spinner className="h-3 w-3" />
          <span className="min-w-0 truncate">{tj(job.type)}</span>
          <button
            type="button"
            onClick={() => void cancel(job.id)}
            disabled={busy[job.id]}
            aria-label={t("cancelJob")}
            title={t("cancelJob")}
            className="ml-auto rounded p-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-accent/15 focus-visible:opacity-100 disabled:opacity-50"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
