import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "@/lib/svg-sanitize";

describe("sanitizeSvg", () => {
  it("keeps a clean SVG's elements and attributes", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><polygon points="0,0 10,10" stroke="currentColor" fill="none"/></svg>';
    const out = sanitizeSvg(svg);
    expect(out).toContain("<svg");
    expect(out).toContain('viewBox="0 0 400 300"');
    expect(out).toContain("polygon");
    expect(out).toContain('stroke="currentColor"');
    expect(out).toContain('fill="none"');
  });

  it("removes script elements", () => {
    const out = sanitizeSvg('<svg><script>alert(1)</script><circle r="5"/></svg>');
    expect(out).not.toContain("script");
    expect(out).not.toContain("alert");
    expect(out).toContain("circle");
    expect(out).toContain('r="5"');
  });

  it("removes self-closing script tags", () => {
    const out = sanitizeSvg('<svg><script src="x.js"/><circle r="5"/></svg>');
    expect(out).not.toContain("script");
  });

  it("removes inline event handlers", () => {
    const out = sanitizeSvg('<svg><rect onclick="alert(1)" width="5"/></svg>');
    expect(out).not.toContain("onclick");
    expect(out).toContain("rect");
  });

  it("removes foreignObject elements with nested content", () => {
    const out = sanitizeSvg(
      '<svg><foreignObject><div onclick="x()">hi</div></foreignObject><circle r="5"/></svg>'
    );
    expect(out).not.toContain("foreignObject");
    expect(out).not.toContain("hi");
    expect(out).toContain("circle");
  });

  it("removes embeddable elements", () => {
    for (const tag of ["iframe", "object", "embed", "image"]) {
      const out = sanitizeSvg(`<svg><${tag} src="http://evil"></${tag}></svg>`);
      expect(out).not.toContain(`<${tag}`);
      expect(out).not.toContain("http://evil");
    }
  });

  it("removes javascript: hrefs", () => {
    const out = sanitizeSvg('<svg><a href="javascript:alert(1)">x</a></svg>');
    expect(out).not.toContain("javascript:");
  });

  it("keeps local fragment hrefs", () => {
    const out = sanitizeSvg('<svg><use href="#shape"/></svg>');
    expect(out).toContain('href="#shape"');
  });

  it("removes dangerous style attributes", () => {
    const out = sanitizeSvg('<svg><rect style="fill: url(javascript:alert(1))" width="5"/></svg>');
    expect(out).not.toContain("javascript:");
  });
});
