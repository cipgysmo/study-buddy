"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; labelKey: "themeSystem" | "themeLight" | "themeDark" }[] = [
  { value: "system", labelKey: "themeSystem" },
  { value: "light", labelKey: "themeLight" },
  { value: "dark", labelKey: "themeDark" },
];

export function ThemeSwitcher({ current }: { current: string }) {
  const t = useTranslations("Settings");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onChange(theme: Theme) {
    if (busy || theme === current) return;
    setBusy(true);
    try {
      await fetch("/api/settings/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      // Apply instantly without waiting for the next server render.
      if (theme === "system") {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", theme);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" role="radiogroup" aria-label={t("appearance")}>
      {OPTIONS.map((opt) => {
        const active = opt.value === current;
        return (
          <label
            key={opt.value}
            className={
              "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors " +
              (active
                ? "border-accent bg-accent/10"
                : "border-border bg-card hover:bg-foreground/5")
            }
          >
            <input
              type="radio"
              name="theme"
              value={opt.value}
              checked={active}
              disabled={busy}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 accent-accent"
            />
            <span className="text-sm font-medium">{t(opt.labelKey)}</span>
          </label>
        );
      })}
    </div>
  );
}
