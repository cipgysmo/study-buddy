import { describe, expect, it } from "vitest";
import { cleanDiagramSvg, isAcceptableDiagramSvg } from "@/lib/diagram";

describe("diagram validation", () => {
  it("accepts a simple valid diagram", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor"/></svg>';
    expect(isAcceptableDiagramSvg(svg)).toBe(true);
    expect(cleanDiagramSvg(svg)).toContain("<line");
  });

  it("rejects missing or invalid viewBox values", () => {
    expect(isAcceptableDiagramSvg('<svg><circle r="5"/></svg>')).toBe(false);
    expect(isAcceptableDiagramSvg('<svg viewBox="0 0 0 300"><circle r="5"/></svg>')).toBe(false);
    expect(isAcceptableDiagramSvg('<svg viewBox="0 0 NaN 300"><circle r="5"/></svg>')).toBe(false);
  });

  it("rejects diagrams without drawing elements", () => {
    expect(
      isAcceptableDiagramSvg('<svg viewBox="0 0 400 300"><text x="10" y="10">x</text></svg>')
    ).toBe(false);
  });

  it("rejects diagrams with too many labels", () => {
    const labels = Array.from({ length: 13 }, (_, i) => `<text x="10" y="${i * 10}">${i}</text>`);
    expect(
      isAcceptableDiagramSvg(
        `<svg viewBox="0 0 400 300"><circle r="5"/>${labels.join("")}</svg>`
      )
    ).toBe(false);
  });

  it("rejects diagrams with too many elements", () => {
    const circles = Array.from({ length: 81 }, () => '<circle r="5"/>').join("");
    expect(isAcceptableDiagramSvg(`<svg viewBox="0 0 400 300">${circles}</svg>`)).toBe(false);
  });

  it("returns null for non-string or empty diagram values", () => {
    expect(cleanDiagramSvg(null)).toBeNull();
    expect(cleanDiagramSvg(undefined)).toBeNull();
    expect(cleanDiagramSvg(123)).toBeNull();
    expect(cleanDiagramSvg("   ")).toBeNull();
  });

  it("sanitizes unsafe markup before validating", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><script>alert(1)</script><circle r="5"/></svg>';
    const out = cleanDiagramSvg(svg);
    expect(out).toContain("<circle");
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
  });
});
