"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CleanupType = "quizzes" | "mockExams" | "exercises" | "truefalse" | "flashcards";

const typeKeys: CleanupType[] = ["quizzes", "mockExams", "exercises", "truefalse", "flashcards"];

function defaultOlderThan(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function CleanupSection() {
  const t = useTranslations("Settings");
  const router = useRouter();
  const [olderThan, setOlderThan] = useState(defaultOlderThan);
  const [selected, setSelected] = useState<Record<CleanupType, boolean>>({
    quizzes: true,
    mockExams: true,
    exercises: true,
    truefalse: true,
    flashcards: true,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function toggle(type: CleanupType) {
    setSelected((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  async function runCleanup() {
    if (busy) return;
    const types = typeKeys.filter((type) => selected[type]);
    if (types.length === 0) return;
    if (!window.confirm(t("cleanupConfirm"))) return;

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThan, types }),
      });
      const d = (await r.json()) as { counts?: Record<CleanupType, number>; error?: string };
      if (!r.ok || !d.counts) throw new Error(d.error || "error");

      const parts = typeKeys
        .filter((type) => d.counts?.[type])
        .map((type) => `${d.counts?.[type]} ${t(`cleanup${type.charAt(0).toUpperCase()}${type.slice(1)}`)}`);
      setMessage(parts.length > 0 ? parts.join(", ") : t("cleanupNothing"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-md space-y-3 rounded-2xl border border-border bg-card p-5">
      <div>
        <h2 className="font-medium">{t("cleanup")}</h2>
        <p className="mt-0.5 text-sm text-muted">{t("cleanupHint")}</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="cleanup-older-than" className="block text-xs font-medium text-muted">
          {t("cleanupOlderThan")}
        </label>
        <Input
          id="cleanup-older-than"
          type="date"
          value={olderThan}
          onChange={(e) => setOlderThan(e.target.value)}
          className="bg-background"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {typeKeys.map((type) => (
          <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected[type]}
              onChange={() => toggle(type)}
              className="accent-[var(--color-accent)]"
            />
            {t(`cleanup${type.charAt(0).toUpperCase()}${type.slice(1)}`)}
          </label>
        ))}
      </div>

      <Button variant="danger" onClick={() => void runCleanup()} disabled={busy}>
        {busy ? t("cleanupRunning") : t("cleanupRun")}
      </Button>

      {message && <p className="text-sm text-muted">{message}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
