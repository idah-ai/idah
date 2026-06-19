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
      expect(selection.value).toEqual(ann);
    });

    it("replaces a previous annotation selection", () => {
      selection.selectAnnotation(mockAnn("ann-001"));
      const ann2 = mockAnn("ann-002");
      selection.selectAnnotation(ann2);
      expect(selection.value!.id).toBe("ann-002");
    });
  });

  describe("deselect", () => {
    it("clears an annotation selection", () => {
      selection.selectAnnotation(mockAnn("ann-001"));
      selection.deselect();
      expect(selection.hasSelection()).toBe(false);
      expect(selection.value).toBeNull();
    });

    it("is safe to call when already null", () => {
      expect(() => selection.deselect()).not.toThrow();
      expect(selection.value).toBeNull();
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

    it("returns false when nothing is selected", () => {
      expect(selection.isAnnotationSelected("ann-001")).toBe(false);
    });
  });
});
