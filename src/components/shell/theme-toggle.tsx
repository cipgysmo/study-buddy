"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useEffectiveTheme } from "@/lib/use-theme";

/**
 * Quick light/dark toggle. Tracks the currently effective theme
 * (explicit data-theme, else the OS preference) and flips it.
 */
export function ThemeToggle() {
  const t = useTranslations("Settings");
  const theme = useEffectiveTheme();
  const toDark = theme === "light";

  const toggle = useCallback(async () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      await fetch("/api/settings/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
    } catch {
      /* the visual toggle already applied; persistence is best-effort */
    }
  }, [theme]);

  const label = toDark ? t("themeDark") : t("themeLight");

  return (
    <button
      onClick={() => void toggle()}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-foreground/5 hover:text-foreground"
    >
      {toDark ? (
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
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
        </svg>
      ) : (
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
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
