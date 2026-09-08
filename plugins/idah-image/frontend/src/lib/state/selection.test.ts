// ---------------------------------------------------------------------------
// selection.test.ts — Unit tests for multi-selection state
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import { selection } from "./selection.svelte";

// Mock the data module — selection.svelte.ts imports data for derived values
// Use a shared mutable array so tests can populate it for resolveAnnotations().
const mockItems = vi.hoisted(() => [] as any[]);

vi.mock("$lib/state/data.svelte", () => ({
  data: {
    annotations: {
      items: mockItems,
    },
  },
}));

const mockAnn = (id: string) => ({ id, shape: {}, value: {} });

describe("selection state", () => {
  beforeEach(() => {
    selection.deselect();
    mockItems.splice(0, mockItems.length);
  });

  describe("initial state", () => {
    it("has no selection", () => {
      expect(selection.hasSelection()).toBe(false);
      expect(selection.value).toBeNull();
      expect(selection.selectedCount).toBe(0);
      expect(selection.selectedAnnotationIds.size).toBe(0);
    });
  });

  describe("selectAnnotation", () => {
    it("selects a single annotation", () => {
      const ann = mockAnn("ann-001");
      mockItems.push(ann);
      selection.selectAnnotation(ann);
      expect(selection.hasSelection()).toBe(true);
      expect(selection.isAnnotationSelected("ann-001")).toBe(true);
      expect(selection.selectedCount).toBe(1);
      expect(selection.selectedAnnotations).toHaveLength(1);
      expect(selection.selectedAnnotations[0].id).toBe("ann-001");
    });

    it("replaces a previous selection", () => {
      selection.selectAnnotation(mockAnn("ann-001"));
      const ann2 = mockAnn("ann-002");
      selection.selectAnnotation(ann2);
      expect(selection.isAnnotationSelected("ann-001")).toBe(false);
      expect(selection.isAnnotationSelected("ann-002")).toBe(true);
      expect(selection.selectedCount).toBe(1);
    });
  });

  describe("toggleAnnotation", () => {
    it("adds an annotation to empty selection", () => {
      selection.toggleAnnotation("ann-001");
      expect(selection.isAnnotationSelected("ann-001")).toBe(true);
      expect(selection.selectedCount).toBe(1);
    });

    it("adds multiple annotations", () => {
      selection.toggleAnnotation("ann-001");
      selection.toggleAnnotation("ann-002");
      expect(selection.isAnnotationSelected("ann-001")).toBe(true);
      expect(selection.isAnnotationSelected("ann-002")).toBe(true);
      expect(selection.selectedCount).toBe(2);
    });

    it("removes an annotation that was already selected", () => {
      selection.toggleAnnotation("ann-001");
      selection.toggleAnnotation("ann-002");
      selection.toggleAnnotation("ann-001");
      expect(selection.isAnnotationSelected("ann-001")).toBe(false);
      expect(selection.isAnnotationSelected("ann-002")).toBe(true);
      expect(selection.selectedCount).toBe(1);
    });
  });

  describe("selectAnnotations", () => {
    it("selects multiple annotations at once", () => {
      selection.selectAnnotations(["ann-001", "ann-002"]);
      expect(selection.isAnnotationSelected("ann-001")).toBe(true);
      expect(selection.isAnnotationSelected("ann-002")).toBe(true);
      expect(selection.selectedCount).toBe(2);
    });

    it("replaces any previous selection", () => {
      selection.selectAnnotations(["ann-001", "ann-002"]);
      selection.selectAnnotations(["ann-003"]);
      expect(selection.isAnnotationSelected("ann-001")).toBe(false);
      expect(selection.isAnnotationSelected("ann-002")).toBe(false);
      expect(selection.isAnnotationSelected("ann-003")).toBe(true);
      expect(selection.selectedCount).toBe(1);
    });

    it("accepts an empty array", () => {
      selection.selectAnnotations([]);
      expect(selection.hasSelection()).toBe(false);
      expect(selection.selectedCount).toBe(0);
    });
  });

  describe("addAnnotations", () => {
    it("adds annotations to current selection", () => {
      selection.selectAnnotations(["ann-001"]);
      selection.addAnnotations(["ann-002", "ann-003"]);
      expect(selection.isAnnotationSelected("ann-001")).toBe(true);
      expect(selection.isAnnotationSelected("ann-002")).toBe(true);
      expect(selection.isAnnotationSelected("ann-003")).toBe(true);
      expect(selection.selectedCount).toBe(3);
    });

    it("does not duplicate existing annotations", () => {
      selection.selectAnnotations(["ann-001"]);
      selection.addAnnotations(["ann-001"]);
      expect(selection.selectedCount).toBe(1);
    });
  });

  describe("deselectAnnotation", () => {
    it("removes a single annotation from a multi-selection", () => {
      selection.selectAnnotations(["ann-001", "ann-002", "ann-003"]);
      selection.deselectAnnotation("ann-002");
      expect(selection.isAnnotationSelected("ann-001")).toBe(true);
      expect(selection.isAnnotationSelected("ann-002")).toBe(false);
      expect(selection.isAnnotationSelected("ann-003")).toBe(true);
      expect(selection.selectedCount).toBe(2);
    });

    it("leaves an empty selection when removing the last one", () => {
      selection.selectAnnotations(["ann-001"]);
      selection.deselectAnnotation("ann-001");
      expect(selection.hasSelection()).toBe(false);
      expect(selection.selectedCount).toBe(0);
    });
  });

  describe("deselect", () => {
    it("clears the selection", () => {
      selection.selectAnnotations(["ann-001", "ann-002"]);
      selection.deselect();
      expect(selection.hasSelection()).toBe(false);
      expect(selection.selectedCount).toBe(0);
    });

    it("is safe to call when already empty", () => {
      expect(() => selection.deselect()).not.toThrow();
    });
  });

  describe("query methods", () => {
    it("isAnnotationSelected returns true for selected ids", () => {
      selection.selectAnnotations(["ann-001", "ann-002"]);
      expect(selection.isAnnotationSelected("ann-001")).toBe(true);
      expect(selection.isAnnotationSelected("ann-002")).toBe(true);
    });

    it("isAnnotationSelected returns false for non-selected ids", () => {
      selection.selectAnnotations(["ann-001"]);
      expect(selection.isAnnotationSelected("ann-999")).toBe(false);
    });

    it("isAnnotationSelected returns false when nothing is selected", () => {
      expect(selection.isAnnotationSelected("ann-001")).toBe(false);
    });

    it("selectedCount returns the correct count", () => {
      expect(selection.selectedCount).toBe(0);
      selection.toggleAnnotation("ann-001");
      expect(selection.selectedCount).toBe(1);
      selection.toggleAnnotation("ann-002");
      expect(selection.selectedCount).toBe(2);
    });
  });

  describe("selectedAnnotations", () => {
    it("returns annotations from the data store matching selected ids", () => {
      const a1 = mockAnn("ann-001");
      const a2 = mockAnn("ann-002");
      const a3 = mockAnn("ann-003");
      mockItems.push(a1, a2, a3);

      selection.selectAnnotations(["ann-001", "ann-003"]);
      const anns = selection.selectedAnnotations;
      expect(anns).toHaveLength(2);
      expect(anns[0].id).toBe("ann-001");
      expect(anns[1].id).toBe("ann-003");
    });

    it("returns empty array when nothing is selected", () => {
      expect(selection.selectedAnnotations).toEqual([]);
    });

    it("returns empty array when no matching items in data store", () => {
      selection.selectAnnotations(["nonexistent"]);
      expect(selection.selectedAnnotations).toEqual([]);
    });
  });

  describe("value (deprecated getter)", () => {
    it("returns the first selected annotation", () => {
      const a1 = mockAnn("ann-001");
      const a2 = mockAnn("ann-002");
      mockItems.push(a1, a2);

      selection.selectAnnotations(["ann-001", "ann-002"]);
      expect(selection.value?.id).toBe("ann-001");
    });

    it("returns null when nothing is selected", () => {
      expect(selection.value).toBeNull();
    });

    it("returns null when selected id is not in data store", () => {
      selection.selectAnnotations(["nonexistent"]);
      expect(selection.value).toBeNull();
    });
  });
});
