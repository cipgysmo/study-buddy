"use client";

import { useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/spinner";
import { useActiveJobs } from "./jobs-provider";

export function JobsIndicator() {
  const t = useTranslations("Common");
  const active = useActiveJobs();
  if (active.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
      <Spinner className="h-3 w-3" />
      {t("inProgress", { count: active.length })}
    </span>
  );
}
