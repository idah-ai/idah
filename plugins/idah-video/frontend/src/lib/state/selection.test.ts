// ---------------------------------------------------------------------------
// selection.test.ts — Unit tests for multi-selection state
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach, vi } from "vitest";
import { selection } from "./selection.svelte";

// Mock the data module — selection.svelte.ts imports data for derived values
// Use a shared mutable array so tests can populate it for resolveAnnotations().
// vi.hoisted() ensures the array exists before the hoisted vi.mock factory runs.
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
      expect(selection.selectedGroupIds.size).toBe(0);
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
      expect(selection.value?.type).toBe("annotation");
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

    it("clears group selection when toggling annotations", () => {
      selection.selectGroup("group-1");
      selection.toggleAnnotation("ann-001");
      expect(selection.isGroupSelected("group-1")).toBe(false);
      expect(selection.isAnnotationSelected("ann-001")).toBe(true);
    });
  });

  describe("selectAnnotations", () => {
    it("selects multiple annotations at once", () => {
      selection.selectAnnotations(["ann-001", "ann-002", "ann-003"]);
      expect(selection.isAnnotationSelected("ann-001")).toBe(true);
      expect(selection.isAnnotationSelected("ann-002")).toBe(true);
      expect(selection.isAnnotationSelected("ann-003")).toBe(true);
      expect(selection.selectedCount).toBe(3);
    });

    it("replaces existing selection", () => {
      selection.toggleAnnotation("ann-001");
      selection.selectAnnotations(["ann-002", "ann-003"]);
      expect(selection.isAnnotationSelected("ann-001")).toBe(false);
      expect(selection.isAnnotationSelected("ann-002")).toBe(true);
      expect(selection.selectedCount).toBe(2);
    });
  });

  describe("addAnnotations", () => {
    it("adds annotations to existing selection", () => {
      selection.toggleAnnotation("ann-001");
      selection.addAnnotations(["ann-002", "ann-003"]);
      expect(selection.isAnnotationSelected("ann-001")).toBe(true);
      expect(selection.isAnnotationSelected("ann-002")).toBe(true);
      expect(selection.selectedCount).toBe(3);
    });
  });

  describe("deselectAnnotation", () => {
    it("removes a single annotation from selection", () => {
      selection.selectAnnotations(["ann-001", "ann-002"]);
      selection.deselectAnnotation("ann-001");
      expect(selection.isAnnotationSelected("ann-001")).toBe(false);
      expect(selection.isAnnotationSelected("ann-002")).toBe(true);
      expect(selection.selectedCount).toBe(1);
    });

    it("is safe when annotation is not selected", () => {
      expect(() => selection.deselectAnnotation("ann-999")).not.toThrow();
    });
  });

  describe("selectGroup", () => {
    it("selects a group", () => {
      selection.selectGroup("group-1");
      expect(selection.isGroupSelected("group-1")).toBe(true);
      expect(selection.hasGroupSelection()).toBe(true);
      expect(selection.value?.type).toBe("group");
    });

    it("replaces annotation selection", () => {
      selection.selectAnnotation(mockAnn("ann-001"));
      selection.selectGroup("group-2");
      expect(selection.isAnnotation()).toBe(false);
      expect(selection.isGroupSelected("group-2")).toBe(true);
    });
  });

  describe("toggleGroup", () => {
    it("adds a group to an empty selection", () => {
      selection.toggleGroup("group-1");
      expect(selection.isGroupSelected("group-1")).toBe(true);
      expect(selection.selectedCount).toBe(1);
    });

    it("adds multiple groups", () => {
      selection.toggleGroup("group-1");
      selection.toggleGroup("group-2");
      expect(selection.isGroupSelected("group-1")).toBe(true);
      expect(selection.isGroupSelected("group-2")).toBe(true);
      expect(selection.selectedCount).toBe(2);
    });

    it("removes a group that was already selected", () => {
      selection.toggleGroup("group-1");
      selection.toggleGroup("group-2");
      selection.toggleGroup("group-1");
      expect(selection.isGroupSelected("group-1")).toBe(false);
      expect(selection.isGroupSelected("group-2")).toBe(true);
      expect(selection.selectedCount).toBe(1);
    });

    it("does NOT clear annotation selection", () => {
      selection.toggleAnnotation("ann-001");
      selection.toggleGroup("group-1");
      expect(selection.isAnnotationSelected("ann-001")).toBe(true);
      expect(selection.isGroupSelected("group-1")).toBe(true);
      expect(selection.selectedCount).toBe(2);
    });
  });

  describe("deselect", () => {
    it("clears annotations and groups", () => {
      selection.selectAnnotations(["ann-001", "ann-002"]);
      selection.selectGroup("group-1");
      selection.deselect();
      expect(selection.hasSelection()).toBe(false);
      expect(selection.selectedCount).toBe(0);
    });

    it("is safe to call when already empty", () => {
      expect(() => selection.deselect()).not.toThrow();
    });
  });

  describe("query methods", () => {
    it("isAnnotation returns true when annotations are selected", () => {
      selection.toggleAnnotation("ann-001");
      expect(selection.isAnnotation()).toBe(true);
      expect(selection.isGroup()).toBe(false);
    });

    it("isGroup returns true when groups are selected", () => {
      selection.selectGroup("group-1");
      expect(selection.isGroup()).toBe(true);
      expect(selection.isAnnotation()).toBe(false);
    });

    it("hasValidSelection matches hasSelection", () => {
      expect(selection.hasValidSelection()).toBe(false);
      selection.toggleAnnotation("ann-001");
      expect(selection.hasValidSelection()).toBe(true);
    });

    it("isAnnotationGroup is true for group selections", () => {
      selection.selectGroup("group-1");
      expect(selection.isAnnotationGroup()).toBe(true);
    });
  });

  describe("selectedGroups", () => {
    it("returns empty array when no groups selected", () => {
      expect(selection.selectedGroups).toEqual([]);
    });

    it("returns group data from data store", () => {
      // The mocked data store is empty, so groups resolve to empty annotations
      selection.selectGroup("group-1");
      expect(selection.selectedGroups[0].groupId).toBe("group-1");
      expect(selection.selectedGroups[0].annotations).toEqual([]);
    });
  });
});