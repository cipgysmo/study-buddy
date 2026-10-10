import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/format";

describe("formatDate", () => {
  it("formats SQLite UTC timestamps", () => {
    expect(formatDate("2026-10-10 12:34:56", "en")).toBe("Oct 10, 2026");
  });

  it("returns the original value when the date is invalid", () => {
    expect(formatDate("not-a-date", "en")).toBe("not-a-date");
  });
});
