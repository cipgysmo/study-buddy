"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MaterialIconButton } from "./material-icon-button";

export function DeleteButton({
  href,
  label,
  onDeleted,
  icon = false,
}: {
  href: string;
  label: string;
  onDeleted?: () => void;
  icon?: boolean;
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

  if (icon) {
    return (
      <MaterialIconButton
        variant="danger"
        onClick={onDelete}
        disabled={busy}
        aria-label={label}
        title={label}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      </MaterialIconButton>
    );
  }

  return (
    <Button variant="danger" size="sm" onClick={onDelete} disabled={busy}>
      {label}
    </Button>
  );
}
