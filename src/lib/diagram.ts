import { sanitizeSvg } from "./svg-sanitize";

const DRAWING_ELEMENT_RE = /<(path|line|circle|rect|polygon|polyline|ellipse)\b/gi;
const TEXT_ELEMENT_RE = /<text\b/gi;
const ELEMENT_RE = /<[a-zA-Z][a-zA-Z0-9:-]*/g;

export function isAcceptableDiagramSvg(svg: string): boolean {
  const s = svg.trim();
  if (!/^<svg\b/i.test(s) || !/<\/svg>/i.test(s)) return false;
  if (/\b(NaN|undefined|null)\b/i.test(s)) return false;

  const viewBox = s.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (!viewBox) return false;
  const parts = viewBox[1].trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return false;
  if (parts[2] <= 0 || parts[3] <= 0) return false;

  const drawingCount = (s.match(DRAWING_ELEMENT_RE) ?? []).length;
  if (drawingCount < 1) return false;

  const textCount = (s.match(TEXT_ELEMENT_RE) ?? []).length;
  if (textCount > 12) return false;

  const elementCount = (s.match(ELEMENT_RE) ?? []).length;
  if (elementCount > 80) return false;

  return true;
}

export function cleanDiagramSvg(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const clean = sanitizeSvg(trimmed);
  return isAcceptableDiagramSvg(clean) ? clean : null;
}
