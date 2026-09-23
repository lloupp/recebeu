import { describe, expect, it } from "vitest";
import { agingBucket, effectiveStatus, sumByStatus } from "./receivables";

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
