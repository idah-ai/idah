// ---------------------------------------------------------------------------
// core-stats.test.ts — core entry stats count only live annotations and
// exclude plugin-declared system shapes (e.g. idah-image's "done-area").
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeCoreStats, systemShapeKeys } from "./core-stats";
import type { IIdahDriverV2, IAnnotationRecord } from "../../types";

const { modalitiesMock } = vi.hoisted(() => ({ modalitiesMock: vi.fn() }));

vi.mock("@/data/model/setting/plugin/record", () => ({
  pluginsBackendDataSource: { modalities: modalitiesMock },
}));

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

describe("systemShapeKeys", () => {
  it("builds modality_id:shape_name keys from the modalities data", () => {
    const keys = systemShapeKeys({
      "idah-image": {
        label: "Image",
        description: null,
        system_shapes: { "done-area": { label: "Done Area" } },
      },
      "idah-video": { label: "Video", description: null },
    });

    expect([...keys]).toEqual(["idah-image:done-area"]);
  });

  it("returns an empty set when no modality declares system_shapes", () => {
    const keys = systemShapeKeys({ "idah-video": { label: "Video", description: null } });
    expect(keys.size).toBe(0);
  });
});

describe("computeCoreStats", () => {
  beforeEach(() => {
    modalitiesMock.mockResolvedValue({ modalities: {}, plugins: {} });
  });

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

  it("excludes system-shape annotations from every count", async () => {
    modalitiesMock.mockResolvedValue({
      modalities: {
        "idah-image": {
          label: "Image",
          description: null,
          system_shapes: { "done-area": { label: "Done Area" } },
        },
      },
      plugins: {},
    });

    const doneArea = makeRecord({ id: "done-1", shape_type: "idah-image:done-area", category: "done_area" });
    const box = makeRecord({ id: "box-1", category: "vehicles/car" });
    const driver = makeDriver([doneArea, box]);

    const stats = await computeCoreStats(driver);

    expect(stats.find((s) => s.key === "annotation.count")?.value).toBe("1");
    expect(stats.find((s) => s.key === "orphan_category.count")?.value).toBe("0");
    expect(stats.find((s) => s.key === "shape.done-area.count")).toBeUndefined();
    expect(stats.find((s) => s.key === "category.done_area.count")).toBeUndefined();
    expect(stats.find((s) => s.key === "shape.bounding-box.count")?.value).toBe("1");
  });

  it("reports 0 annotations when only system-shape annotations are present", async () => {
    modalitiesMock.mockResolvedValue({
      modalities: {
        "idah-image": {
          label: "Image",
          description: null,
          system_shapes: { "done-area": { label: "Done Area" } },
        },
      },
      plugins: {},
    });

    const doneArea = makeRecord({ id: "done-1", shape_type: "idah-image:done-area", category: "done_area" });
    const driver = makeDriver([doneArea]);

    const stats = await computeCoreStats(driver);

    expect(stats.find((s) => s.key === "annotation.count")?.value).toBe("0");
    expect(stats.find((s) => s.key === "orphan_category.count")?.value).toBe("0");
  });
});
