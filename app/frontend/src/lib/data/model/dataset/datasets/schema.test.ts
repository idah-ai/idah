import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deliveryDateChangeSchema } from "./schema";

describe("deliveryDateChangeSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 0, 15, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a changed past date", () => {
    const result = deliveryDateChangeSchema.safeParse({
      delivery_date: "2030-01-14",
      original_delivery_date: "2030-01-13",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["delivery_date"]);
    }
  });

  it("allows an unchanged past date", () => {
    expect(
      deliveryDateChangeSchema.safeParse({
        delivery_date: "2030-01-14",
        original_delivery_date: "2030-01-14",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid calendar date", () => {
    expect(deliveryDateChangeSchema.safeParse({ delivery_date: "2030-02-30" }).success).toBe(false);
  });

  it("allows null and omitted dates", () => {
    expect(deliveryDateChangeSchema.safeParse({ delivery_date: null }).success).toBe(true);
    expect(deliveryDateChangeSchema.safeParse({}).success).toBe(true);
  });

  it("allows today and future dates", () => {
    expect(deliveryDateChangeSchema.safeParse({ delivery_date: "2030-01-15" }).success).toBe(true);
    expect(deliveryDateChangeSchema.safeParse({ delivery_date: "2030-01-16" }).success).toBe(true);
  });
});
