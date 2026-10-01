"use client";

import { useSyncExternalStore } from "react";

function effectiveTheme(): "light" | "dark" {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  const mo = new MutationObserver(callback);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => {
    mq.removeEventListener("change", callback);
    mo.disconnect();
  };
}

/** Currently effective theme ("light" | "dark"), reactive to data-theme and OS changes. */
export function useEffectiveTheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribe,
    effectiveTheme,
    () => "light"
  );
}
