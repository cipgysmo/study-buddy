import { describe, expect, it } from "vitest";
import { extractTocEntries } from "@/lib/toc";

describe("extractTocEntries", () => {
  it("parses a Czech table of contents and maps printed pages to PDF pages", () => {
    const pages = [
      {
        page_number: 2,
        text: [
          "Obsah",
          "1. Úvod ................ 3",
          "2. Proměnné ............ 10",
          "2.1 Typy dat ........... 12",
        ].join("\n"),
      },
      { page_number: 3, text: "1. Úvod\nZákladní pojmy." },
      { page_number: 10, text: "2. Proměnné\nUkládání hodnot." },
      { page_number: 12, text: "2.1 Typy dat\nČísla a text." },
    ];

    const entries = extractTocEntries(pages, 20);
    expect(entries.map((e) => e.title)).toEqual(["1. Úvod", "2. Proměnné", "2.1 Typy dat"]);
    expect(entries.map((e) => e.pdfPageStart)).toEqual([3, 10, 12]);
    expect(entries[0].pdfPageEnd).toBe(9);
    expect(entries[1].pdfPageEnd).toBe(11);
    expect(entries[2].pdfPageEnd).toBe(20);
  });
});
