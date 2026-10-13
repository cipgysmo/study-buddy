"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function TimezoneField({ current }: { current: string }) {
  const t = useTranslations("Settings");
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const timezones = (() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    } catch {
      return [];
    }
  })();

  async function save() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const r = await fetch("/api/settings/timezone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: value }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "error");
      setMessage(t("timezoneSaved"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          list="timezone-options"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-10 min-w-64 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
          placeholder="Europe/Prague"
        />
        <datalist id="timezone-options">
          {timezones.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
        <Button onClick={save} disabled={busy || !value.trim()}>
          {t("save")}
        </Button>
      </div>
      {message && <p className="text-sm text-success">{message}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
