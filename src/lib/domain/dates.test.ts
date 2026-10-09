import { describe, expect, it } from "vitest";
import { localToday } from "./dates";

describe("localToday", () => {
  it("respects Sao Paulo at the UTC date boundary", () => {
    expect(localToday(new Date("2026-10-09T01:30:00Z"))).toBe("2026-10-08");
  });

  it("accepts a different organization's timezone", () => {
    expect(localToday(new Date("2026-10-09T01:30:00Z"), "UTC")).toBe("2026-10-09");
  });
});
