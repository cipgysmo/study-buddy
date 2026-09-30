"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LANGUAGES } from "@/i18n/languages";

export function LanguageSwitcher({ current }: { current: string }) {
  const t = useTranslations("Settings");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onChange(locale: string) {
    if (busy || locale === current) return;
    setBusy(true);
    try {
      await fetch("/api/settings/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" role="radiogroup" aria-label={t("language")}>
      {LANGUAGES.map((lang) => {
        const active = lang.code === current;
        return (
          <label
            key={lang.code}
            className={
              "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors " +
              (active
                ? "border-accent bg-accent/10"
                : "border-border bg-card hover:bg-foreground/5")
            }
          >
            <input
              type="radio"
              name="language"
              value={lang.code}
              checked={active}
              disabled={busy}
              onChange={() => onChange(lang.code)}
              className="h-4 w-4 accent-accent"
            />
            <span className="text-sm font-medium">{lang.nativeName}</span>
          </label>
        );
      })}
    </div>
  );
}
