// ---------------------------------------------------------------------------
// confirm-delete.test.ts — showConfirmDeleteAnnotationsDialog shared helper
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const { mockShowConfirmDialog } = vi.hoisted(() => ({
  mockShowConfirmDialog: vi.fn(),
}));

vi.mock("./confirm-dialog", () => ({
  showConfirmDialog: mockShowConfirmDialog,
}));

import { showConfirmDeleteAnnotationsDialog } from "./confirm-delete";

describe("showConfirmDeleteAnnotationsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses shape/category-specific singular copy when available", () => {
    showConfirmDeleteAnnotationsDialog({
      count: 1,
      shape: "bounding box",
      annotation_category: "car",
      onConfirm: () => {},
    });

    expect(mockShowConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete annotation",
        description: 'Are you sure you want to delete this bounding box annotation ("car")?',
      }),
    );
  });

  it("falls back to generic singular copy when shape/category are unknown", () => {
    showConfirmDeleteAnnotationsDialog({ count: 1, onConfirm: () => {} });

    expect(mockShowConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete annotation",
        description: "Are you sure you want to delete this annotation?",
      }),
    );
  });

  it("uses pluralized copy for multiple annotations", () => {
    showConfirmDeleteAnnotationsDialog({ count: 3, onConfirm: () => {} });

    expect(mockShowConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete all annotations",
        description: "Are you sure you want to delete all 3 selected annotations in this entry?",
      }),
    );
  });

  it("honors custom title/description overrides", () => {
    showConfirmDeleteAnnotationsDialog({
      count: 5,
      title: "Delete all annotations",
      description: "Are you sure you want to delete all annotations?",
      onConfirm: () => {},
    });

    expect(mockShowConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete all annotations",
        description: "Are you sure you want to delete all annotations?",
      }),
    );
  });

  it("passes through the onConfirm callback", () => {
    const onConfirm = vi.fn();
    showConfirmDeleteAnnotationsDialog({ count: 1, onConfirm });

    const { onConfirm: passed } = mockShowConfirmDialog.mock.calls[0][0];
    passed();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("passes through the onCancel callback", () => {
    const onCancel = vi.fn();
    showConfirmDeleteAnnotationsDialog({ count: 1, onConfirm: () => {}, onCancel });

    const { onCancel: passed } = mockShowConfirmDialog.mock.calls[0][0];
    passed();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("uses tag copy when type is 'tag'", () => {
    showConfirmDeleteAnnotationsDialog({
      count: 1,
      type: "tag",
      shape: "frame",
      annotation_category: "collision",
      onConfirm: () => {},
    });

    expect(mockShowConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete frame tag",
        description: 'Are you sure you want to delete this frame tag ("collision")?',
      }),
    );
  });

  it("derives tag type from frame / entry:root shapes", () => {
    showConfirmDeleteAnnotationsDialog({
      count: 1,
      shape: "Entry:root",
      annotation_category: "scene",
      onConfirm: () => {},
    });

    expect(mockShowConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete Video tag",
        description: 'Are you sure you want to delete this Video tag ("scene")?',
      }),
    );
  });

  it("uses tag copy for multiple tags", () => {
    showConfirmDeleteAnnotationsDialog({ count: 2, type: "tag", onConfirm: () => {} });

    expect(mockShowConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete all tags",
        description: "Are you sure you want to delete all 2 selected tags in this entry?",
      }),
    );
  });
});
