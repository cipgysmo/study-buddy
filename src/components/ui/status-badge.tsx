"use client";

import { useTranslations } from "next-intl";
import { Spinner } from "./spinner";

export type JobStatus = "processing" | "ready" | "failed";

export function StatusBadge({
  status,
  label,
}: {
  status: JobStatus;
  label?: string;
}) {
  const t = useTranslations("Common");

  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
        <Spinner className="h-3 w-3" />
        {label ?? t("processing")}
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-medium text-danger"
        title={label}
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
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {t("failed")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
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
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      {label ?? t("ready")}
    </span>
  );
}
