// ---------------------------------------------------------------------------
// hover.test.ts — Unit tests for hovered annotation state
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach } from "vitest";
import { hover } from "./hover.svelte";

describe("hover state", () => {
  beforeEach(() => hover.clearHovered(hover.value ?? ""));

  describe("initial state", () => {
    it("has nothing hovered", () => {
      expect(hover.value).toBeNull();
    });
  });

  describe("setHovered", () => {
    it("sets the hovered annotation", () => {
      hover.setHovered("ann-001");
      expect(hover.value).toBe("ann-001");
    });

    it("replaces a previously hovered annotation", () => {
      hover.setHovered("ann-001");
      hover.setHovered("ann-002");
      expect(hover.value).toBe("ann-002");
    });
  });

  describe("isHovered", () => {
    it("returns true for the hovered annotation id", () => {
      hover.setHovered("ann-001");
      expect(hover.isHovered("ann-001")).toBe(true);
    });

    it("returns false for a different annotation id", () => {
      hover.setHovered("ann-001");
      expect(hover.isHovered("ann-999")).toBe(false);
    });

    it("returns false when nothing is hovered", () => {
      expect(hover.isHovered("ann-001")).toBe(false);
    });
  });

  describe("clearHovered", () => {
    it("clears the hover when the id matches", () => {
      hover.setHovered("ann-001");
      hover.clearHovered("ann-001");
      expect(hover.value).toBeNull();
    });

    // Overlapping shapes fire the incoming mouseenter before the outgoing
    // mouseleave. The stale leave must not blank the hover just set.
    it("is a no-op when a stale id arrives after another shape took the hover", () => {
      hover.setHovered("ann-001");
      hover.setHovered("ann-002");
      hover.clearHovered("ann-001");
      expect(hover.value).toBe("ann-002");
    });

    it("is safe to call when nothing is hovered", () => {
      expect(() => hover.clearHovered("ann-001")).not.toThrow();
      expect(hover.value).toBeNull();
    });
  });
});
