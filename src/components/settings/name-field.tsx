"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NameField({ current }: { current: string }) {
  const t = useTranslations("Settings");
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/settings/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          maxLength={60}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            }
          }}
          placeholder={t("namePlaceholder")}
          aria-label={t("name")}
        />
        <Button onClick={() => void save()} loading={busy} className="shrink-0">
          {t("save")}
        </Button>
      </div>
      {saved && <p className="text-sm text-success">{t("nameSaved")}</p>}
    </div>
  );
}
