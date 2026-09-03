// ---------------------------------------------------------------------------
// tagging-annotations.test.ts — Unit tests for entry:root uniqueness logic
// ---------------------------------------------------------------------------
import { describe, it, expect } from "vitest";

import { findEntryRootAnnotation, resolveEntryRoot, isTaggingValueComplete } from "./tagging-annotations";
import type { IImageAnnotationRecord } from "$lib/types";
import type { IConfigProperty } from "$idah/v2/types";

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