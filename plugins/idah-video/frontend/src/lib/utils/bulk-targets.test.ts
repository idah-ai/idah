import { describe, expect, it } from "vitest";
import type { IAnnotationRecord } from "$idah/v2/types";
import { resolveBulkTargets } from "./bulk-targets";

const record = (id: string, groupId?: string, category = "vehicle"): IAnnotationRecord => ({
  id,
  shape_type: "idah-video:bounding-box",
  shape_args: { start: 0, end: 1 },
  category,
  properties: {},
  metadata: groupId ? { group_id: groupId } : undefined,
});

describe("resolveBulkTargets", () => {
  it("includes off-frame group members and counts a directly selected member once", () => {
    const allItems = [record("frame-1", "track-7"), record("frame-2", "track-7"),
      record("off-frame", "track-7"), record("other", "track-8")];
    const result = resolveBulkTargets(["frame-1"], ["track-7"], allItems);

    expect(result.items.map((item) => item.id)).toEqual(["frame-1", "frame-2", "off-frame"]);
    expect(result.missingAnnotationIds).toEqual([]);
    expect(result.missingGroupIds).toEqual([]);
  });

  it("reports every unresolved ID and group instead of reducing the target count silently", () => {
    const result = resolveBulkTargets(["known", "missing"], ["track-7", "unknown"], [record("known")]);

    expect(result.items.map((item) => item.id)).toEqual(["known"]);
    expect(result.missingAnnotationIds).toEqual(["missing"]);
    expect(result.missingGroupIds).toEqual(["track-7", "unknown"]);
  });

  it("uses the annotation ID as the group key when group_id is absent", () => {
    const result = resolveBulkTargets([], ["solo"], [record("solo"), record("other")]);
    expect(result.items.map((item) => item.id)).toEqual(["solo"]);
  });

  it("uses the latest copy of an annotation when full-entry and local records overlap", () => {
    const result = resolveBulkTargets([], ["track-7"], [
      record("frame-1", "track-7", "vehicle"),
      record("frame-1", "track-7", "pedestrian"),
    ]);
    expect(result.items).toEqual([record("frame-1", "track-7", "pedestrian")]);
  });
});
