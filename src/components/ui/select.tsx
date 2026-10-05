import { forwardRef } from "react";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className = "", children, ...props }, ref) => (
  <select
    ref={ref}
    className={`w-full cursor-pointer rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-ring ${className}`}
    {...props}
  >
    {children}
  </select>
));

Select.displayName = "Select";
