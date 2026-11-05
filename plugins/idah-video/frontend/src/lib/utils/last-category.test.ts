import { describe, expect, it } from "vitest";

import { findLastCategory, planCategoryReuse } from "./last-category";

const box = "idah-video:bounding-box";
const tagging = new Set(["entry:root", "idah-video:frame"]);
const item = (id: string, category: string | null, shape_type = box) => ({ id, shape_type, category });

describe("findLastCategory", () => {
  it("returns undefined when there are no annotations", () => {
    expect(findLastCategory([], tagging)).toBeUndefined();
  });

  it("picks the newest annotation by UUIDv7 id, whatever the list order", () => {
    const items = [
      item("0190a000-0000-7000-8000-000000000002", "vehicle/car"),
      item("0190a000-0000-7000-8000-000000000003", "person/adult"),
      item("0190a000-0000-7000-8000-000000000001", "animal/dog"),
    ];
    expect(findLastCategory(items, tagging)).toEqual({
      category: "person/adult",
      shapeType: box,
      annotationId: "0190a000-0000-7000-8000-000000000003",
    });
  });

  it("skips tagging annotations and annotations without a category", () => {
    const items = [
      item("0190a000-0000-7000-8000-000000000001", "vehicle/car"),
      item("0190a000-0000-7000-8000-000000000002", null),
      item("0190a000-0000-7000-8000-000000000003", "", box),
      item("0190a000-0000-7000-8000-000000000004", "weather/rain", "entry:root"),
      item("0190a000-0000-7000-8000-000000000005", "scene/night", "idah-video:frame"),
    ];
    expect(findLastCategory(items, tagging)?.category).toBe("vehicle/car");
  });

  it("keeps the shape type of the annotation it came from", () => {
    const items = [item("0190a000-0000-7000-8000-000000000001", "lane", "idah-video:polygon")];
    expect(findLastCategory(items, tagging)?.shapeType).toBe("idah-video:polygon");
  });
});

describe("planCategoryReuse", () => {
  const last = { category: "vehicle/car", shapeType: box, annotationId: "a" };

  it("does nothing when no annotation has been created", () => {
    expect(planCategoryReuse(undefined, undefined, false)).toEqual({ action: "none" });
  });

  it("picks the category for drawing when nothing is selected", () => {
    expect(planCategoryReuse(last, undefined, false)).toEqual({
      action: "draw",
      category: "vehicle/car",
      shapeType: box,
    });
  });

  it("picks it for drawing when the selection already has it (the annotation just drawn)", () => {
    expect(planCategoryReuse(last, "vehicle/car", true)).toEqual({
      action: "draw",
      category: "vehicle/car",
      shapeType: box,
    });
  });

  it("changes the selection when it has another category", () => {
    expect(planCategoryReuse(last, "person/adult", true)).toEqual({
      action: "relabel",
      category: "vehicle/car",
      shapeType: box,
    });
  });

  it("changes a selection that has no category yet", () => {
    expect(planCategoryReuse(last, undefined, true).action).toBe("relabel");
  });
});
