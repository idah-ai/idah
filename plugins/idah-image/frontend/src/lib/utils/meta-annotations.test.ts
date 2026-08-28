// ---------------------------------------------------------------------------
// meta-annotations.test.ts — Unit tests for entry:root uniqueness logic
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";

import { findEntryRootAnnotation, resolveEntryRoot } from "./meta-annotations";
import type { IImageAnnotationRecord } from "$lib/types";

function rootRecord(category?: string, id = "root-001"): IImageAnnotationRecord {
  return {
    id,
    shape: { type: "entry:root", points: [] },
    value: { category },
  } as IImageAnnotationRecord;
}

function boxRecord(id = "box-001"): IImageAnnotationRecord {
  return {
    id,
    shape: { type: "idah-image:bounding-box", points: [] },
    value: { category: "car" },
  } as IImageAnnotationRecord;
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