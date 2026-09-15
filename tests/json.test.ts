import { describe, expect, it } from "vitest";
import { extractJSON } from "@/lib/json";

describe("extractJSON", () => {
  it("parses a raw JSON object", () => {
    expect(extractJSON<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in a code fence", () => {
    expect(extractJSON<{ a: number }>("```json\n{\"a\":2}\n```")).toEqual({ a: 2 });
  });

  it("parses JSON surrounded by prose", () => {
    expect(
      extractJSON<{ a: number }>('Sure! Here you go: {"a":3} hope that helps')
    ).toEqual({ a: 3 });
  });

  it("parses a JSON array", () => {
    expect(extractJSON<number[]>("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("handles nested braces and braces inside strings", () => {
    const s = 'noise {"a":"}","b":{"c":"{"}} tail';
    expect(extractJSON<{ a: string; b: { c: string } }>(s)).toEqual({
      a: "}",
      b: { c: "{" },
    });
  });

  it("throws on unparseable input", () => {
    expect(() => extractJSON("no json here")).toThrow();
  });
});
