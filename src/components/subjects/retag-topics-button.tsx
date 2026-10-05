"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useJob } from "@/lib/use-jobs";

/**
 * Re-derive topics from the content of all of a subject's note materials (a
 * background job, since each material is an LLM call). Refreshes the page when
 * done so the freshly created topics and per-material tags appear.
 */
export function RetagTopicsButton({ subjectId }: { subjectId: string }) {
  const t = useTranslations("Subjects");
  const router = useRouter();
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const busy = jobId !== null;

  useJob(jobId, (settled) => {
    setJobId(null);
    if (settled.status === "done") {
      router.refresh();
    } else {
      setError(settled.error ?? "error");
    }
  });

  async function retag() {
    if (busy) return;
    setError("");
    try {
      const r = await fetch(`/api/subjects/${subjectId}/retag`, { method: "POST" });
      const d = (await r.json()) as { job?: { id: string }; error?: string };
      if (!r.ok || !d.job) throw new Error(d.error ?? "error");
      setJobId(d.job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => void retag()} disabled={busy}>
        {busy ? t("retagging") : t("retagAll")}
      </Button>
      <span className="text-xs text-muted">{t("retagHint")}</span>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
