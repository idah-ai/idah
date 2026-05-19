// ---------------------------------------------------------------------------
// annotation.test.ts — Unit tests for annotation visibility & lock state
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach } from "vitest";
import { annotation } from "./annotation.svelte";

describe("annotation state", () => {
  beforeEach(() => {
    annotation.clearLocked();
    annotation.clearHidden();
  });

  describe("initial state", () => {
    it("reports no ids as locked", () => {
      expect(annotation.isLocked("ann-001")).toBe(false);
    });

    it("reports no ids as hidden", () => {
      expect(annotation.isHidden("ann-001")).toBe(false);
    });
  });

  describe("toggleLocked", () => {
    it("locks an annotation", () => {
      annotation.toggleLocked("ann-001", true);
      expect(annotation.isLocked("ann-001")).toBe(true);
    });

    it("unlocks a previously locked annotation", () => {
      annotation.toggleLocked("ann-001", true);
      annotation.toggleLocked("ann-001", false);
      expect(annotation.isLocked("ann-001")).toBe(false);
    });

    it("does not affect other annotations when locking", () => {
      annotation.toggleLocked("ann-001", true);
      expect(annotation.isLocked("ann-002")).toBe(false);
    });

    it("does not affect other annotations when unlocking", () => {
      annotation.toggleLocked("ann-001", true);
      annotation.toggleLocked("ann-002", true);
      annotation.toggleLocked("ann-001", false);
      expect(annotation.isLocked("ann-002")).toBe(true);
      expect(annotation.isLocked("ann-001")).toBe(false);
    });

    it("is idempotent when locking an already-locked id", () => {
      annotation.toggleLocked("ann-001", true);
      annotation.toggleLocked("ann-001", true);
      expect(annotation.isLocked("ann-001")).toBe(true);
    });

    it("is idempotent when unlocking an already-unlocked id", () => {
      annotation.toggleLocked("ann-001", false);
      expect(annotation.isLocked("ann-001")).toBe(false);
    });
  });

  describe("toggleHidden", () => {
    it("hides an annotation", () => {
      annotation.toggleHidden("ann-001", true);
      expect(annotation.isHidden("ann-001")).toBe(true);
    });

    it("unhides a previously hidden annotation", () => {
      annotation.toggleHidden("ann-001", true);
      annotation.toggleHidden("ann-001", false);
      expect(annotation.isHidden("ann-001")).toBe(false);
    });

    it("does not affect other annotations when hiding", () => {
      annotation.toggleHidden("ann-001", true);
      expect(annotation.isHidden("ann-002")).toBe(false);
    });

    it("does not affect other annotations when unhiding", () => {
      annotation.toggleHidden("ann-001", true);
      annotation.toggleHidden("ann-002", true);
      annotation.toggleHidden("ann-001", false);
      expect(annotation.isHidden("ann-002")).toBe(true);
      expect(annotation.isHidden("ann-001")).toBe(false);
    });

    it("is idempotent when hiding an already-hidden id", () => {
      annotation.toggleHidden("ann-001", true);
      annotation.toggleHidden("ann-001", true);
      expect(annotation.isHidden("ann-001")).toBe(true);
    });

    it("is idempotent when unhiding an already-visible id", () => {
      annotation.toggleHidden("ann-001", false);
      expect(annotation.isHidden("ann-001")).toBe(false);
    });
  });

  describe("clearLocked", () => {
    it("unlocks all locked annotations", () => {
      annotation.toggleLocked("ann-001", true);
      annotation.toggleLocked("ann-002", true);
      annotation.clearLocked();
      expect(annotation.isLocked("ann-001")).toBe(false);
      expect(annotation.isLocked("ann-002")).toBe(false);
    });

    it("is safe to call when nothing is locked", () => {
      expect(() => annotation.clearLocked()).not.toThrow();
    });
  });

  describe("clearHidden", () => {
    it("unhides all hidden annotations", () => {
      annotation.toggleHidden("ann-001", true);
      annotation.toggleHidden("ann-002", true);
      annotation.clearHidden();
      expect(annotation.isHidden("ann-001")).toBe(false);
      expect(annotation.isHidden("ann-002")).toBe(false);
    });

    it("is safe to call when nothing is hidden", () => {
      expect(() => annotation.clearHidden()).not.toThrow();
    });
  });

  describe("independent lock and hidden state", () => {
    it("tracks lock and hidden independently", () => {
      annotation.toggleLocked("ann-001", true);
      annotation.toggleHidden("ann-001", true);
      expect(annotation.isLocked("ann-001")).toBe(true);
      expect(annotation.isHidden("ann-001")).toBe(true);
    });

    it("clearing lock does not affect hidden state", () => {
      annotation.toggleLocked("ann-001", true);
      annotation.toggleHidden("ann-001", true);
      annotation.clearLocked();
      expect(annotation.isLocked("ann-001")).toBe(false);
      expect(annotation.isHidden("ann-001")).toBe(true);
    });

    it("clearing hidden does not affect lock state", () => {
      annotation.toggleLocked("ann-001", true);
      annotation.toggleHidden("ann-001", true);
      annotation.clearHidden();
      expect(annotation.isHidden("ann-001")).toBe(false);
      expect(annotation.isLocked("ann-001")).toBe(true);
    });
  });
});