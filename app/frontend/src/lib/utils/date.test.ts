import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDeliveryStatusBadge, isOverdue } from "@/utils/date";

describe("isOverdue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 0, 15, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for null or omitted dates", () => {
    expect(isOverdue(null)).toBe(false);
    expect(isOverdue(undefined)).toBe(false);
  });

  it("marks yesterday overdue, but not today or tomorrow", () => {
    expect(isOverdue("2030-01-14")).toBe(true);
    expect(isOverdue("2030-01-15")).toBe(false);
    expect(isOverdue("2030-01-16")).toBe(false);
  });

  it("accepts Date values and keeps a deadline valid until local midnight", () => {
    const deadline = new Date(2030, 0, 15);
    expect(isOverdue(deadline, new Date(2030, 0, 15, 23, 59, 59))).toBe(false);
    expect(isOverdue(deadline, new Date(2030, 0, 16))).toBe(true);
  });
});

describe("getDeliveryStatusBadge", () => {
  it.each([
    ["2026-11-16", false, "Overdue", "destructive"],
    ["2026-11-17", false, "Due today", "orange"],
    ["2026-11-18", false, "Due tomorrow", "warning"],
    ["2026-11-20", false, "Due in 3 days", "default"],
    [null, false, "No due date", "gray"],
    [undefined, false, "No due date", "gray"],
    ["invalid", false, "No due date", "gray"],
    ["2026-11-16", true, "Completed", "success"],
    [null, true, "Completed", "success"],
  ] as const)("classifies %s (completed=%s)", (date, completed, label, variant) => {
    expect(getDeliveryStatusBadge(date, completed, new Date(2026, 10, 17))).toMatchObject({ label, variant });
  });

  it.each([
    [new Date(2026, 2, 8), "2026-03-09"],
    [new Date(2026, 10, 1), "2026-11-02"],
    [new Date(2026, 11, 31), "2027-01-01"],
    [new Date(2024, 1, 28), "2024-02-29"],
  ] as const)("uses calendar days across DST/year/leap boundaries (%s)", (day, date) => {
    expect(getDeliveryStatusBadge(date, false, day).label).toBe("Due tomorrow");
  });

  it("keeps date-only deadlines local until midnight", () => {
    expect(getDeliveryStatusBadge("2026-11-17", false, new Date(2026, 10, 17, 23, 59)).label).toBe("Due today");
    expect(getDeliveryStatusBadge("2026-11-17", false, new Date(2026, 10, 18, 0, 1)).label).toBe("Overdue");
  });
});
