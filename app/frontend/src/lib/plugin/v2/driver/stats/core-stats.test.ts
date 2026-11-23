// ---------------------------------------------------------------------------
// core-stats.test.ts — core entry stats count only live annotations
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from "vitest";
import { computeCoreStats } from "./core-stats";
import type { IIdahDriverV2, IAnnotationRecord } from "../../types";

function makeRecord(overrides: Partial<IAnnotationRecord> = {}): IAnnotationRecord {
  return {
    id: "ann-1",
    shape_type: "idah-video:bounding-box",
    shape_args: { start: 1, end: 10 },
    category: "vehicles/car",
    properties: {},
    metadata: {},
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    version: 1,
    ...overrides,
  };
}

function makeDriver(annotations: IAnnotationRecord[]): IIdahDriverV2 {
  return {
    annotations: {
      fetch: vi.fn().mockResolvedValue(annotations),
    },
    config: {
      "idah-video:bounding-box": { values: [{ id: "vehicles/car" }, { id: "vehicles/truck" }] },
    },
  } as unknown as IIdahDriverV2;
}

describe("computeCoreStats", () => {
  it("counts only live annotations, ignoring tombstones", async () => {
    const live = makeRecord({ id: "live-1", category: "vehicles/car" });
    const tomb = makeRecord({ id: "tomb-1", category: "vehicles/truck", deleted_at: new Date("2026-01-02T00:00:00Z") });
    const driver = makeDriver([live, tomb]);

    const stats = await computeCoreStats(driver);

    const total = stats.find((s) => s.key === "annotation.count");
    expect(total?.value).toBe("1");

    const car = stats.find((s) => s.key === "category.vehicles/car.count");
    const truck = stats.find((s) => s.key === "category.vehicles/truck.count");
    expect(car?.value).toBe("1");
    expect(truck?.value).toBe("0");
  });
});
