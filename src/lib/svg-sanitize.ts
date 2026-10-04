import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize LLM-generated standalone SVG for safe inline rendering.
 *
 * Primary pass is DOMPurify with a strict SVG-only profile (no HTML, no
 * embedded/executable content). A small pre-pass neutralizes dangerous inline
 * `style` values (url(javascript:), expression()) that DOMPurify's CSS handling
 * can miss under jsdom. The SVG comes from our own local model, so this is
 * defense in depth rather than a hard security boundary.
 */

// Elements that embed or execute external content; never needed in our diagrams.
const FORBID_TAGS = ["foreignObject", "iframe", "object", "embed", "image", "script", "style"];
// <use> is valid SVG but not in DOMPurify's default allowlist.
const ADD_TAGS = ["use"];
// Presentation/reference attributes the model commonly emits.
const ADD_ATTR = [
  "xlink:href",
  "href",
  "transform",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "fill-rule",
  "clip-rule",
  "text-anchor",
  "dominant-baseline",
  "marker-end",
  "marker-start",
];

export function sanitizeSvg(svg: string): string {
  // Strip inline style attributes whose value could execute or load remote code.
  const pre = svg.replace(
    /\sstyle\s*=\s*("[^"]*(?:javascript:|expression\(|url\()[^"]*"|'[^']*(?:javascript:|expression\(|url\()[^']*')/gi,
    ""
  );
  return DOMPurify.sanitize(pre, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS,
    ADD_ATTR,
    FORBID_TAGS,
  });
}
