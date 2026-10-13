"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/status-badge";

export function MaterialStatus({
  materialId,
  status,
  error,
  jobId,
  canReprocess = false,
}: {
  materialId: string;
  status: string;
  error: string | null;
  jobId: string | null;
  canReprocess?: boolean;
}) {
  const t = useTranslations("Common");
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  async function reprocess() {
    if (retrying) return;
    setRetrying(true);
    try {
      await fetch(`/api/materials/${materialId}/reprocess`, { method: "POST" });
      router.refresh();
    } finally {
      setRetrying(false);
    }
  }

  if (status === "ready") {
    if (!canReprocess) return null;
    return (
      <button
        onClick={reprocess}
        disabled={retrying}
        className="cursor-pointer text-xs font-medium text-accent hover:underline disabled:opacity-50"
      >
        {t("reprocess")}
      </button>
    );
  }
  if (status === "processing") return <StatusBadge status="processing" />;

  async function retry() {
    if (!jobId || retrying) return;
    setRetrying(true);
    try {
      await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
      router.refresh();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <span className="flex shrink-0 items-center gap-2" title={error ?? undefined}>
      <StatusBadge status="failed" />
      {jobId && (
        <button
          onClick={retry}
          disabled={retrying}
          className="cursor-pointer text-xs font-medium text-accent hover:underline disabled:opacity-50"
        >
          {t("retry")}
        </button>
      )}
    </span>
  );
}
