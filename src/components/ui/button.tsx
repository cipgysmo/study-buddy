"use client";

import { forwardRef } from "react";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "md" | "sm";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground shadow-soft transition hover:opacity-90 active:opacity-80",
  secondary:
    "border border-border bg-card text-foreground shadow-soft transition hover:bg-foreground/5 active:bg-foreground/10",
  danger: "text-muted transition hover:bg-danger/10 hover:text-danger active:bg-danger/15",
  ghost: "text-accent transition hover:bg-accent/10 active:bg-accent/15",
};

const sizeStyles: Record<Size, string> = {
  md: "min-h-10 px-4 py-2 text-sm",
  sm: "min-h-8 px-3 py-1.5 text-xs",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
