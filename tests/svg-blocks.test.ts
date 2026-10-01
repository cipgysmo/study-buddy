import { describe, expect, it } from "vitest";
import { splitSvgBlocks } from "@/lib/svg-blocks";

describe("splitSvgBlocks", () => {
  it("returns a single text part when there is no svg block", () => {
    expect(splitSvgBlocks("hello world")).toEqual([{ text: "hello world", svg: null }]);
  });

  it("returns an empty string as a single text part", () => {
    expect(splitSvgBlocks("")).toEqual([{ text: "", svg: null }]);
  });

  it("extracts a single svg block", () => {
    const content = "Look:\n```svg\n<svg viewBox=\"0 0 400 300\"></svg>\n```\ndone";
    expect(splitSvgBlocks(content)).toEqual([
      { text: "Look:\n", svg: null },
      { text: "", svg: '<svg viewBox="0 0 400 300"></svg>' },
      { text: "\ndone", svg: null },
    ]);
  });

  it("extracts multiple svg blocks in order", () => {
    const content = "a```svg\n<svg>1</svg>\n```b```svg\n<svg>2</svg>\n```c";
    expect(splitSvgBlocks(content)).toEqual([
      { text: "a", svg: null },
      { text: "", svg: "<svg>1</svg>" },
      { text: "b", svg: null },
      { text: "", svg: "<svg>2</svg>" },
      { text: "c", svg: null },
    ]);
  });

  it("ignores other fenced blocks", () => {
    const content = "```js\nconsole.log(1)\n```\ntext";
    expect(splitSvgBlocks(content)).toEqual([
      { text: "```js\nconsole.log(1)\n```\ntext", svg: null },
    ]);
  });

  it("drops an empty svg block", () => {
    const content = "a```svg\n   \n```b";
    expect(splitSvgBlocks(content)).toEqual([
      { text: "a", svg: null },
      { text: "b", svg: null },
    ]);
  });

  it("handles an incomplete trailing block as plain text", () => {
    const content = "a```svg\n<svg>unclosed";
    expect(splitSvgBlocks(content)).toEqual([{ text: content, svg: null }]);
  });
});
