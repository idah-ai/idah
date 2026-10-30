// ---------------------------------------------------------------------------
// confirm-delete.ts — Shared confirmation dialog for destructive annotation
// deletions.
//
// Single source of truth for the "are you sure?" copy so every delete entry
// point (annotation list menus, "delete all", keyboard shortcut, workspace
// actions, …) asks in exactly the same way.
// ---------------------------------------------------------------------------
import { showConfirmDialog } from "./confirm-dialog";

export interface ConfirmAnnotationsDeleteOptions {
  /** Number of annotations being deleted (drives the default copy). */
  count: number;
  /** Optional custom dialog title (overrides the count-based default). */
  title?: string;
  /** Optional custom dialog description (overrides the count-based default). */
  description?: string;
  /** Shape of the annotation being deleted (used in the singular confirmation message). */
  shape?: string;
  /** Category of the annotation being deleted (used in the singular confirmation message). */
  annotation_category?: string | undefined;
  /** Called when the user clicks Confirm. */
  onConfirm: () => void | Promise<void>;
  /** Called when the user dismisses the dialog without confirming. */
  onCancel?: () => void;
}

export function showConfirmDeleteAnnotationsDialog(opts: ConfirmAnnotationsDeleteOptions): void {
  const { count, onConfirm, onCancel, shape, annotation_category } = opts;
  const singular = count === 1;

  showConfirmDialog({
    title:
      opts.title ??
      (singular ? "Delete annotation" : "Delete all annotations"),

    description:
      opts.description ??
      (singular
        ? shape && annotation_category
          ? `Are you sure you want to delete this ${shape} annotation ("${annotation_category}")?`
          : "Are you sure you want to delete this annotation?"
        : `Are you sure you want to delete all ${count} selected annotations in this entry?`),

    onConfirm,
    onCancel,
  });
}
