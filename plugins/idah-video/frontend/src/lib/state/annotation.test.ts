// ---------------------------------------------------------------------------
// annotation.test.ts — Unit tests for annotation visibility & lock state
// ---------------------------------------------------------------------------
import { describe, it, expect, beforeEach } from "vitest";
import { annotation } from "./annotation.svelte";
import type { IAnnotationRecord } from "$idah/v2/types";

/** Create a minimal annotation record for testing purposes. */
function mockRecord(id: string, group_id?: string): IAnnotationRecord {
  return {
    id,
    shape: {},
    metadata: group_id != null ? { group_id } : undefined,
  };
}

const ann1 = mockRecord("ann-001");
const ann2 = mockRecord("ann-002");

describe("annotation state", () => {
  beforeEach(() => {
    annotation.clearLocked();
    annotation.clearHidden();
  });

  describe("initial state", () => {
    it("reports no ids as locked", () => {
      expect(annotation.isLocked(ann1)).toBe(false);
    });

    it("reports no ids as hidden", () => {
      expect(annotation.isHidden(ann1)).toBe(false);
    });
  });

  describe("toggleLocked", () => {
    it("locks an annotation", () => {
      annotation.toggleLocked(ann1.id, true);
      expect(annotation.isLocked(ann1)).toBe(true);
    });

    it("unlocks a previously locked annotation", () => {
      annotation.toggleLocked(ann1.id, true);
      annotation.toggleLocked(ann1.id, false);
      expect(annotation.isLocked(ann1)).toBe(false);
    });

    it("does not affect other annotations when locking", () => {
      annotation.toggleLocked(ann1.id, true);
      expect(annotation.isLocked(ann2)).toBe(false);
    });

    it("does not affect other annotations when unlocking", () => {
      annotation.toggleLocked(ann1.id, true);
      annotation.toggleLocked(ann2.id, true);
      annotation.toggleLocked(ann1.id, false);
      expect(annotation.isLocked(ann2)).toBe(true);
      expect(annotation.isLocked(ann1)).toBe(false);
    });

    it("is idempotent when locking an already-locked id", () => {
      annotation.toggleLocked(ann1.id, true);
      annotation.toggleLocked(ann1.id, true);
      expect(annotation.isLocked(ann1)).toBe(true);
    });

    it("is idempotent when unlocking an already-unlocked id", () => {
      annotation.toggleLocked(ann1.id, false);
      expect(annotation.isLocked(ann1)).toBe(false);
    });
  });

  describe("toggleHidden", () => {
    it("hides an annotation", () => {
      annotation.toggleHidden(ann1.id, true);
      expect(annotation.isHidden(ann1)).toBe(true);
    });

    it("unhides a previously hidden annotation", () => {
      annotation.toggleHidden(ann1.id, true);
      annotation.toggleHidden(ann1.id, false);
      expect(annotation.isHidden(ann1)).toBe(false);
    });

    it("does not affect other annotations when hiding", () => {
      annotation.toggleHidden(ann1.id, true);
      expect(annotation.isHidden(ann2)).toBe(false);
    });

    it("does not affect other annotations when unhiding", () => {
      annotation.toggleHidden(ann1.id, true);
      annotation.toggleHidden(ann2.id, true);
      annotation.toggleHidden(ann1.id, false);
      expect(annotation.isHidden(ann2)).toBe(true);
      expect(annotation.isHidden(ann1)).toBe(false);
    });

    it("is idempotent when hiding an already-hidden id", () => {
      annotation.toggleHidden(ann1.id, true);
      annotation.toggleHidden(ann1.id, true);
      expect(annotation.isHidden(ann1)).toBe(true);
    });

    it("is idempotent when unhiding an already-visible id", () => {
      annotation.toggleHidden(ann1.id, false);
      expect(annotation.isHidden(ann1)).toBe(false);
    });
  });

  describe("clearLocked", () => {
    it("unlocks all locked annotations", () => {
      annotation.toggleLocked(ann1.id, true);
      annotation.toggleLocked(ann2.id, true);
      annotation.clearLocked();
      expect(annotation.isLocked(ann1)).toBe(false);
      expect(annotation.isLocked(ann2)).toBe(false);
    });

    it("is safe to call when nothing is locked", () => {
      expect(() => annotation.clearLocked()).not.toThrow();
    });
  });

  describe("clearHidden", () => {
    it("unhides all hidden annotations", () => {
      annotation.toggleHidden(ann1.id, true);
      annotation.toggleHidden(ann2.id, true);
      annotation.clearHidden();
      expect(annotation.isHidden(ann1)).toBe(false);
      expect(annotation.isHidden(ann2)).toBe(false);
    });

    it("is safe to call when nothing is hidden", () => {
      expect(() => annotation.clearHidden()).not.toThrow();
    });
  });

  describe("independent lock and hidden state", () => {
    it("tracks lock and hidden independently", () => {
      annotation.toggleLocked(ann1.id, true);
      annotation.toggleHidden(ann1.id, true);
      expect(annotation.isLocked(ann1)).toBe(true);
      expect(annotation.isHidden(ann1)).toBe(true);
    });

    it("clearing lock does not affect hidden state", () => {
      annotation.toggleLocked(ann1.id, true);
      annotation.toggleHidden(ann1.id, true);
      annotation.clearLocked();
      expect(annotation.isLocked(ann1)).toBe(false);
      expect(annotation.isHidden(ann1)).toBe(true);
    });

    it("clearing hidden does not affect lock state", () => {
      annotation.toggleLocked(ann1.id, true);
      annotation.toggleHidden(ann1.id, true);
      annotation.clearHidden();
      expect(annotation.isHidden(ann1)).toBe(false);
      expect(annotation.isLocked(ann1)).toBe(true);
    });
  });

  describe("group_id integration", () => {
    it("isLocked returns true when group_id is locked", () => {
      const groupAnn = mockRecord("ann-group-child", "group-1");
      annotation.toggleLocked("group-1", true);
      expect(annotation.isLocked(groupAnn)).toBe(true);
    });

    it("isHidden returns true when group_id is hidden", () => {
      const groupAnn = mockRecord("ann-group-child", "group-1");
      annotation.toggleHidden("group-1", true);
      expect(annotation.isHidden(groupAnn)).toBe(true);
    });

    it("isLocked prefers group_id over individual unlock when annotation id was removed", () => {
      const groupAnn = mockRecord("ann-group-child", "group-1");
      annotation.toggleLocked("group-1", true);
      annotation.toggleLocked("ann-group-child", false);
      expect(annotation.isLocked(groupAnn)).toBe(true);
    });

    it("isHidden prefers group_id over individual unhide when annotation id was removed", () => {
      const groupAnn = mockRecord("ann-group-child", "group-1");
      annotation.toggleHidden("group-1", true);
      annotation.toggleHidden("ann-group-child", false);
      expect(annotation.isHidden(groupAnn)).toBe(true);
    });

    it("isLocked returns false when no group_id and id is not locked", () => {
      const standalone = mockRecord("standalone-001");
      expect(annotation.isLocked(standalone)).toBe(false);
    });

    it("isHidden returns false when no group_id and id is not hidden", () => {
      const standalone = mockRecord("standalone-001");
      expect(annotation.isHidden(standalone)).toBe(false);
    });
  });
});