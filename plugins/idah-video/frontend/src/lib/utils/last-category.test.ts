import { describe, expect, it } from "vitest";

import { findLastCategory } from "./last-category";

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
