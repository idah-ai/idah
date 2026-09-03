// ---------------------------------------------------------------------------
// tagging-annotations.test.ts — Unit tests for entry:root / idah-video:frame uniqueness
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";

import {
  findFrameAnnotation,
  findFrameAnnotations,
  findEntryRootAnnotation,
  resolveFrame,
  resolveEntryRoot,
  isTaggingValueComplete,
} from "./tagging-annotations";
import type { IVideoAnnotationRecord } from "$lib/types";
import type { IConfigProperty } from "$idah/v2/types";

function rootRecord(category?: string, id = "root-001"): IVideoAnnotationRecord {
  return {
    id,
    shape: { type: "entry:root", start: 0, end: 100, frames: [] },
    value: { category },
  } as IVideoAnnotationRecord;
}

function frameRecord(frame: number, category?: string, id = `frame-${frame}`): IVideoAnnotationRecord {
  return {
    id,
    shape: { type: "idah-video:frame", start: frame, end: frame, frames: [{ frame, angle: 0, points: [] }] },
    value: { category },
  } as IVideoAnnotationRecord;
}

function boxRecord(id = "box-001"): IVideoAnnotationRecord {
  return {
    id,
    shape: { type: "idah-video:bounding-box", start: 10, end: 20, frames: [] },
    value: { category: "car" },
  } as IVideoAnnotationRecord;
}

describe("findEntryRootAnnotation", () => {
  it("returns undefined when no entry:root annotation exists", () => {
    expect(findEntryRootAnnotation([boxRecord()])).toBeUndefined();
    expect(findEntryRootAnnotation([])).toBeUndefined();
  });

  it("finds the entry:root annotation among other shapes", () => {
    const root = rootRecord("scene");
    expect(findEntryRootAnnotation([boxRecord(), root])).toBe(root);
  });
});

describe("findFrameAnnotation", () => {
  it("returns undefined when no idah-video:frame annotation exists for the (frame, category)", () => {
    expect(findFrameAnnotation([frameRecord(5, "a")], 6, "a")).toBeUndefined();
    expect(findFrameAnnotation([], 5, "a")).toBeUndefined();
  });

  it("finds the idah-video:frame annotation for the exact (frame, category)", () => {
    const f5 = frameRecord(5, "a");
    expect(findFrameAnnotation([frameRecord(4, "a"), f5, frameRecord(6, "a")], 5, "a")).toBe(f5);
  });

  it("returns undefined when the category differs at the same frame", () => {
    const f5 = frameRecord(5, "a");
    expect(findFrameAnnotation([f5], 5, "b")).toBeUndefined();
  });
});

describe("findFrameAnnotations", () => {
  it("returns all idah-video:frame annotations for the frame across categories", () => {
    const fa = frameRecord(5, "a");
    const fb = frameRecord(5, "b");
    const fc = frameRecord(6, "a");
    expect(findFrameAnnotations([fa, fb, fc], 5)).toEqual([fa, fb]);
  });

  it("returns empty when none exist for the frame", () => {
    expect(findFrameAnnotations([], 5)).toEqual([]);
  });
});

describe("resolveEntryRoot", () => {
  it("updates the existing record when one exists", () => {
    const existing = rootRecord("scene");
    const res = resolveEntryRoot([existing], { category: "new-scene" });
    expect(res.action).toBe("update");
    if (res.action === "update") expect(res.existing).toBe(existing);
  });

  it("creates a new record when none exists and a category is provided", () => {
    const res = resolveEntryRoot([boxRecord()], { category: "scene" });
    expect(res.action).toBe("create");
  });

  it("does nothing when none exists and no category is provided", () => {
    const res = resolveEntryRoot([], {});
    expect(res.action).toBe("none");
  });
});

describe("resolveFrame", () => {
  it("updates the existing record for the same (frame, category)", () => {
    const existing = frameRecord(5, "a");
    const res = resolveFrame([existing], 5, "a", { category: "a" });
    expect(res.action).toBe("update");
    if (res.action === "update") expect(res.existing).toBe(existing);
  });

  it("creates a new record when none exists for the (frame, category) and a category is provided", () => {
    const res = resolveFrame([frameRecord(4, "a")], 5, "b", { category: "b" });
    expect(res.action).toBe("create");
  });

  it("does nothing when none exists for the (frame, category) and no category is provided", () => {
    const res = resolveFrame([], 5, "a", {});
    expect(res.action).toBe("none");
  });

  it("creates a separate annotation for a different category at the same frame", () => {
    const existing = frameRecord(5, "a");
    const res = resolveFrame([existing], 5, "b", { category: "b" });
    expect(res.action).toBe("create");
  });
});

describe("isTaggingValueComplete", () => {
  const required: IConfigProperty[] = [
    { id: "label", required: true, type: "text", format: {} } as IConfigProperty,
  ];
  const optional: IConfigProperty[] = [
    { id: "label", required: false, type: "text", format: {} } as IConfigProperty,
  ];

  it("is true when no required properties exist", () => {
    expect(isTaggingValueComplete({ category: "a" }, [])).toBe(true);
  });

  it("is true when all required properties are filled", () => {
    expect(isTaggingValueComplete({ category: "a", attributes: { label: "x" } }, required)).toBe(true);
  });

  it("is false when a required property is missing", () => {
    expect(isTaggingValueComplete({ category: "a", attributes: {} }, required)).toBe(false);
    expect(isTaggingValueComplete({ category: "a" }, required)).toBe(false);
  });

  it("ignores optional properties", () => {
    expect(isTaggingValueComplete({ category: "a" }, optional)).toBe(true);
  });
});