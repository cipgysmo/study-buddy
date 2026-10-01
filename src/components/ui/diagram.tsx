"use client";

import { useMemo } from "react";
import { sanitizeSvg } from "@/lib/svg-sanitize";

/**
 * Renders a standalone SVG (from the LLM) inline. Sanitized, sized to its
 * content (no scrollbars), and theme-aware: the SVG uses currentColor, which
 * resolves to the app's foreground color.
 */
export function Diagram({ svg, className = "" }: { svg: string; className?: string }) {
  const clean = useMemo(() => sanitizeSvg(svg), [svg]);
  if (!clean.trim()) return null;
  return (
    <div
      className={`text-foreground [&_svg]:block [&_svg]:h-auto [&_svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
