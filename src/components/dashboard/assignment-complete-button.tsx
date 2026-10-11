"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function AssignmentCompleteButton({ id }: { id: string }) {
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function complete() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/assignments/${id}/complete`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={() => void complete()} disabled={busy}>
      {t("markDone")}
    </Button>
  );
}
