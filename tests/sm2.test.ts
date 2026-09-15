import { describe, expect, it } from "vitest";
import { sm2 } from "@/lib/sm2";

describe("sm2", () => {
  it("resets on a failed recall (q < 3)", () => {
    const r = sm2({ ease: 2.5, interval: 10, reps: 3 }, 1, "2026-09-15");
    expect(r.reps).toBe(0);
    expect(r.interval).toBe(1);
    expect(r.dueISO).toBe("2026-09-16");
  });

  it("first successful recall -> 1 day", () => {
    const r = sm2({ ease: 2.5, interval: 0, reps: 0 }, 4, "2026-09-15");
    expect(r.interval).toBe(1);
    expect(r.reps).toBe(1);
  });

  it("second successful recall -> 6 days", () => {
    const r = sm2({ ease: 2.5, interval: 1, reps: 1 }, 4, "2026-09-15");
    expect(r.interval).toBe(6);
    expect(r.reps).toBe(2);
  });

  it("subsequent recall multiplies interval by ease", () => {
    const r = sm2({ ease: 2.5, interval: 6, reps: 2 }, 5, "2026-09-15");
    expect(r.interval).toBe(Math.round(6 * 2.5));
    expect(r.reps).toBe(3);
  });

  it("ease never drops below 1.3", () => {
    const r = sm2({ ease: 1.3, interval: 1, reps: 1 }, 0, "2026-09-15");
    expect(r.ease).toBeGreaterThanOrEqual(1.3);
  });
});
