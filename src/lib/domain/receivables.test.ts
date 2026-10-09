import { describe, expect, it } from "vitest";
import { agingBucket, effectiveStatus, sumByStatus, sumByAging } from "./receivables";

describe("receivables domain", () => {
  it("derives overdue from due date", () => {
    expect(
      effectiveStatus(
        { amount: 100, due_date: "2026-09-01", status: "pending" },
        "2026-09-23",
      ),
    ).toBe("overdue");
  });

  it("keeps paid items paid", () => {
    expect(
      effectiveStatus(
        { amount: 100, due_date: "2026-01-01", status: "paid" },
        "2026-09-23",
      ),
    ).toBe("paid");
  });

  it("classifies aging", () => {
    expect(agingBucket("2026-09-20", "2026-09-23")).toBe("1_7");
    expect(agingBucket("2026-08-01", "2026-09-23")).toBe("31_60");
  });

  it("groups outstanding amounts into aging buckets without counting paid or cancelled", () => {
    const items = [
      { amount: 200, due_date: "2026-10-01", status: "pending" as const },
      { amount: 100, due_date: "2026-09-22", status: "pending" as const },
      { amount: 50, due_date: "2026-08-10", status: "pending" as const },
      { amount: 80, due_date: "2026-01-01", status: "paid" as const },
      { amount: 90, due_date: "2026-01-01", status: "cancelled" as const },
    ];
    expect(sumByAging(items, "2026-09-23")).toEqual({
      not_due: 200, "1_7": 100, "8_30": 0, "31_60": 50, "61_90": 0, "90_plus": 0,
    });
  });

  it("sums effective statuses", () => {
    const totals = sumByStatus(
      [
        { amount: 100, due_date: "2026-09-01", status: "pending" },
        { amount: 200, due_date: "2026-10-01", status: "pending" },
        { amount: 50, due_date: "2026-09-01", status: "paid" },
      ],
      "2026-09-23",
    );
    expect(totals).toEqual({ paid: 50, pending: 200, overdue: 100 });
  });
});
