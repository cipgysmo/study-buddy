"use client";

import { forwardRef } from "react";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "md" | "sm";

const variantStyles: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground transition-opacity hover:opacity-90",
  secondary:
    "border border-border bg-card text-foreground transition-colors hover:bg-foreground/5",
  danger: "text-muted transition-colors hover:bg-danger/10 hover:text-danger",
  ghost: "text-accent transition-opacity hover:opacity-70",
};

const sizeStyles: Record<Size, string> = {
  md: "px-4 py-2 text-sm",
  sm: "px-2 py-1 text-xs",
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
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
