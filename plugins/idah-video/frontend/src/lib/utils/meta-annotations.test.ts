// ---------------------------------------------------------------------------
// meta-annotations.test.ts — Unit tests for entry:root / idah-video:frame uniqueness
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";

import {
  findFrameAnnotation,
  findEntryRootAnnotation,
  resolveFrame,
  resolveEntryRoot,
} from "./meta-annotations";
import type { IVideoAnnotationRecord } from "$lib/types";

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
  it("returns undefined when no idah-video:frame annotation exists for the frame", () => {
    expect(findFrameAnnotation([frameRecord(5)], 6)).toBeUndefined();
    expect(findFrameAnnotation([], 5)).toBeUndefined();
  });

  it("finds the idah-video:frame annotation for the exact frame", () => {
    const f5 = frameRecord(5);
    expect(findFrameAnnotation([frameRecord(4), f5, frameRecord(6)], 5)).toBe(f5);
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
  it("updates the existing record for the same frame", () => {
    const existing = frameRecord(5, "a");
    const res = resolveFrame([existing], 5, { category: "b" });
    expect(res.action).toBe("update");
    if (res.action === "update") expect(res.existing).toBe(existing);
  });

  it("creates a new record when none exists for the frame and a category is provided", () => {
    const res = resolveFrame([frameRecord(4)], 5, { category: "b" });
    expect(res.action).toBe("create");
  });

  it("does nothing when none exists for the frame and no category is provided", () => {
    const res = resolveFrame([], 5, {});
    expect(res.action).toBe("none");
  });
});