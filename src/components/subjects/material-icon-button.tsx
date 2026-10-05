"use client";

import type { ButtonHTMLAttributes } from "react";

export function MaterialIconButton({
  variant = "default",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "danger";
}) {
  const base =
    "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition hover:bg-foreground/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";
  const variantClass = variant === "danger" ? "hover:bg-danger/10 hover:text-danger" : "";

  return (
    <button className={`${base} ${variantClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
