"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface Health {
  llm: "ok" | "error";
  model: string;
  error?: string;
}

/** Polls /api/health every 30s and shows whether the local LLM router is reachable. */
export function LlmStatus() {
  const t = useTranslations("Common");
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const d = (await r.json()) as Health;
        if (!stop) setHealth(d);
      } catch {
        /* ignore */
      }
    }
    void poll();
    const iv = setInterval(() => void poll(), 30000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, []);

  if (!health) return null;
  const ok = health.llm === "ok";
  return (
    <span
      className="flex min-w-0 items-center gap-1.5 text-xs text-muted"
      title={ok ? health.model : (health.error ?? "")}
    >
      <span
        className={"h-2 w-2 shrink-0 rounded-full " + (ok ? "bg-success" : "bg-danger")}
        aria-hidden="true"
      />
      <span className="truncate">{ok ? health.model : t("llmOffline")}</span>
    </span>
  );
}
