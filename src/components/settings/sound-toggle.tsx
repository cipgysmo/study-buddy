"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function SoundToggle({ current }: { current: "on" | "off" }) {
  const t = useTranslations("Settings");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const on = current === "on";

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = on ? "off" : "on";
    try {
      await fetch("/api/settings/sound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sound: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={t("sound")}
      onClick={() => void toggle()}
      disabled={busy}
      className={
        "relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 " +
        (on ? "bg-accent" : "bg-foreground/20")
      }
    >
      <span
        className={
          "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform " +
          (on ? "translate-x-5" : "translate-x-0")
        }
      />
    </button>
  );
}
