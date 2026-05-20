// ---------------------------------------------------------------------------
// selection.test.ts — Unit tests for selection state
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach } from "vitest";
import { selection } from "./selection.svelte";

const mockAnn = (id: string) => ({ id, shape: {}, value: {} });

describe("selection state", () => {
  beforeEach(() => selection.deselect());

  describe("initial state", () => {
    it("has no selection", () => {
      expect(selection.hasSelection()).toBe(false);
      expect(selection.value).toBeNull();
    });
  });

  describe("selectAnnotation", () => {
    it("selects an annotation", () => {
      const ann = mockAnn("ann-001");
      selection.selectAnnotation(ann);
      expect(selection.hasSelection()).toBe(true);
      expect(selection.value).toEqual({ type: "annotation", annotation: ann });
    });

    it("replaces a previous annotation selection", () => {
      selection.selectAnnotation(mockAnn("ann-001"));
      const ann2 = mockAnn("ann-002");
      selection.selectAnnotation(ann2);
      expect(selection.value!.type).toBe("annotation");
      expect((selection.value! as any).annotation.id).toBe("ann-002");
    });

    it("replaces a previous group selection", () => {
      selection.selectGroup("group-x");
      selection.selectAnnotation(mockAnn("ann-003"));
      expect(selection.value!.type).toBe("annotation");
    });
  });

  describe("selectGroup", () => {
    it("selects a group", () => {
      selection.selectGroup("group-1");
      expect(selection.hasSelection()).toBe(true);
      expect(selection.value).toEqual({ type: "group", groupId: "group-1" });
    });

    it("replaces a previous annotation selection", () => {
      selection.selectAnnotation(mockAnn("ann-001"));
      selection.selectGroup("group-2");
      expect(selection.value!.type).toBe("group");
      expect((selection.value! as any).groupId).toBe("group-2");
    });
  });

  describe("deselect", () => {
    it("clears an annotation selection", () => {
      selection.selectAnnotation(mockAnn("ann-001"));
      selection.deselect();
      expect(selection.hasSelection()).toBe(false);
      expect(selection.value).toBeNull();
    });

    it("clears a group selection", () => {
      selection.selectGroup("group-1");
      selection.deselect();
      expect(selection.hasSelection()).toBe(false);
    });

    it("is safe to call when already null", () => {
      expect(() => selection.deselect()).not.toThrow();
      expect(selection.value).toBeNull();
    });
  });

  describe("isAnnotation", () => {
    it("returns true when annotation is selected", () => {
      selection.selectAnnotation(mockAnn("ann-001"));
      expect(selection.isAnnotation()).toBe(true);
    });

    it("returns false when group is selected", () => {
      selection.selectGroup("group-1");
      expect(selection.isAnnotation()).toBe(false);
    });

    it("returns false when nothing is selected", () => {
      expect(selection.isAnnotation()).toBe(false);
    });
  });

  describe("isAnnotationSelected", () => {
    it("returns true for the selected annotation id", () => {
      selection.selectAnnotation(mockAnn("ann-001"));
      expect(selection.isAnnotationSelected("ann-001")).toBe(true);
    });

    it("returns false for a different annotation id", () => {
      selection.selectAnnotation(mockAnn("ann-001"));
      expect(selection.isAnnotationSelected("ann-999")).toBe(false);
    });

    it("returns false when a group is selected", () => {
      selection.selectGroup("group-1");
      expect(selection.isAnnotationSelected("ann-001")).toBe(false);
    });

    it("returns false when nothing is selected", () => {
      expect(selection.isAnnotationSelected("ann-001")).toBe(false);
    });
  });

  describe("isGroup", () => {
    it("returns true when group is selected", () => {
      selection.selectGroup("group-1");
      expect(selection.isGroup()).toBe(true);
    });

    it("returns false when annotation is selected", () => {
      selection.selectAnnotation(mockAnn("ann-001"));
      expect(selection.isGroup()).toBe(false);
    });

    it("returns false when nothing is selected", () => {
      expect(selection.isGroup()).toBe(false);
    });
  });
});