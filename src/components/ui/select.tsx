import { forwardRef } from "react";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className = "", children, ...props }, ref) => (
  <select
    ref={ref}
    className={`w-full cursor-pointer rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-accent ${className}`}
    {...props}
  >
    {children}
  </select>
));

Select.displayName = "Select";
