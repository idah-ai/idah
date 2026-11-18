import { describe, expect, it } from "vitest";
import { marqueeSelectionIds } from "./marquee-selection";
import type { IAnnotationRecord } from "$idah/v2/types";

const item = (id: string): IAnnotationRecord => ({
  id, shape_type: "idah-image:bounding-box", shape_args: {}, category: "vehicle", properties: {},
});

describe("marqueeSelectionIds", () => {
  it("selects intersecting visible annotations and skips hidden ones", () => {
    const items = [item("visible-a"), item("hidden"), item("visible-b"), item("outside")];
    const bounds = new Map<string, [number, number, number, number]>([
      ["visible-a", [0.1, 0.1, 0.3, 0.3]],
      ["hidden", [0.2, 0.2, 0.4, 0.4]],
      ["visible-b", [0.4, 0.4, 0.6, 0.6]],
      ["outside", [0.8, 0.8, 0.9, 0.9]],
    ]);

    expect(marqueeSelectionIds(
      items,
      [0, 0, 0.7, 0.7],
      (annotation) => annotation.id === "hidden",
      (annotation) => bounds.get(annotation.id) ?? null,
    )).toEqual(["visible-a", "visible-b"]);
  });

  it("excludes annotations without selectable geometry", () => {
    expect(marqueeSelectionIds(
      [item("no-shape")], [0, 0, 1, 1], () => false, () => null,
    )).toEqual([]);
  });
});
