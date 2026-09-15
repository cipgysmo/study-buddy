"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteButton({
  href,
  label,
  onDeleted,
}: {
  href: string;
  label: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (busy) return;
    if (!window.confirm(label)) return;
    setBusy(true);
    try {
      await fetch(href, { method: "DELETE" });
      onDeleted?.();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
