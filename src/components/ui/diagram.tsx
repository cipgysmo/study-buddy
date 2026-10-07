"use client";

import { useMemo } from "react";
import { cleanDiagramSvg } from "@/lib/diagram";

/**
 * Renders a standalone SVG (from the LLM) inline. Sanitized, quality-checked,
 * sized to its content (no scrollbars), and theme-aware: the SVG uses
 * currentColor, which resolves to the app's foreground color.
 */
export function Diagram({ svg, className = "" }: { svg: string; className?: string }) {
  const clean = useMemo(() => cleanDiagramSvg(svg), [svg]);
  if (!clean) return null;
  return (
    <div
      className={`text-foreground [&_svg]:block [&_svg]:h-auto [&_svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
