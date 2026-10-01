/**
 * Sanitize LLM-generated standalone SVG for safe inline rendering.
 * Pure and SSR-safe (no DOM APIs). Strips executable/embedded content and
 * dangerous attributes. The SVG comes from our own local model, so this is
 * defense in depth rather than a hard security boundary.
 */
export function sanitizeSvg(svg: string): string {
  let s = svg;
  // Remove <script> elements (with or without content).
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<script\b[^>]*\/?>/gi, "");
  // Remove elements that can embed or execute external content.
  for (const tag of ["foreignObject", "iframe", "object", "embed", "image"]) {
    s = s.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, "gi"), "");
    s = s.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }
  // Remove inline event handlers (on*="...").
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Remove javascript: URLs in href / xlink:href.
  s = s.replace(
    /\s(xlink:)?href\s*=\s*("[^"]*javascript:[^"]*"|'[^']*javascript:[^']*')/gi,
    ""
  );
  // Remove style attributes with dangerous content.
  s = s.replace(
    /\sstyle\s*=\s*("[^"]*(?:javascript:|expression\(|url\()[^"]*"|'[^']*(?:javascript:|expression\(|url\()[^']*')/gi,
    ""
  );
  return s;
}
