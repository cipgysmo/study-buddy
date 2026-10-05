import { forwardRef } from "react";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className = "", ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring ${className}`}
    {...props}
  />
));

Input.displayName = "Input";
