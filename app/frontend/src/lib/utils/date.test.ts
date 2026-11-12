import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isOverdue } from "@/utils/date";

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
