// ---------------------------------------------------------------------------
// confirm-delete.test.ts — confirmAnnotationsDelete shared helper
// ---------------------------------------------------------------------------
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────

const { mockShowConfirmDialog } = vi.hoisted(() => ({
  mockShowConfirmDialog: vi.fn(),
}));

vi.mock("./confirm-dialog", () => ({
  showConfirmDialog: mockShowConfirmDialog,
}));

import { confirmAnnotationsDelete } from "./confirm-delete";

describe("confirmAnnotationsDelete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses shape/category-specific singular copy when available", () => {
    confirmAnnotationsDelete({
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
    confirmAnnotationsDelete({ count: 1, onConfirm: () => {} });

    expect(mockShowConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete annotation",
        description: "Are you sure you want to delete this annotation?",
      }),
    );
  });

  it("uses pluralized copy for multiple annotations", () => {
    confirmAnnotationsDelete({ count: 3, onConfirm: () => {} });

    expect(mockShowConfirmDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete all annotations",
        description: "Are you sure you want to delete all 3 selected annotations in this entry?",
      }),
    );
  });

  it("honors custom title/description overrides", () => {
    confirmAnnotationsDelete({
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
    confirmAnnotationsDelete({ count: 1, onConfirm });

    const { onConfirm: passed } = mockShowConfirmDialog.mock.calls[0][0];
    passed();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("passes through the onCancel callback", () => {
    const onCancel = vi.fn();
    confirmAnnotationsDelete({ count: 1, onConfirm: () => {}, onCancel });

    const { onCancel: passed } = mockShowConfirmDialog.mock.calls[0][0];
    passed();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});