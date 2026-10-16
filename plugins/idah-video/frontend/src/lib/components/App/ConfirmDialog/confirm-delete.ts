// ---------------------------------------------------------------------------
// confirm-delete.ts — Shared confirmation dialog for destructive annotation
// deletions.
//
// Single source of truth for the "are you sure?" copy so every delete entry
// point (annotation list menus, timeline context menus, keyboard shortcut,
// workspace actions, …) asks in exactly the same way.
//
// The delete target can be an annotation or a tag (frame tag / entry:root
// video tag). Pass `type` explicitly, or rely on the shape-based derivation:
// shape "frame" / "entry:root" → tag, everything else → annotation.
// ---------------------------------------------------------------------------
import { showConfirmDialog } from "./confirm-dialog";

export type DeletionTargetType = "annotation" | "tag";

/** Derive the delete-target kind from a shape identifier. */
export function deletionTargetType(shape?: string): DeletionTargetType {
  return shape === "frame" || shape === "entry:root" ? "tag" : "annotation";
}

export interface ConfirmAnnotationsDeleteOptions {
  /** Number of annotations/tags being deleted (drives the default copy). */
  count: number;
  /** Optional custom dialog title (overrides the count-based default). */
  title?: string;
  /** Optional custom dialog description (overrides the count-based default). */
  description?: string;
  /** Shape of the target being deleted (used in the singular confirmation message). */
  shape?: string;
  /** Category of the target being deleted (used in the singular confirmation message). */
  annotation_category?: string | undefined;
  /**
   * Whether the delete target is an annotation or a tag (frame / entry:root).
   * When omitted it is derived from `shape`: "frame" / "entry:root" → "tag",
   * anything else → "annotation".
   */
  type?: DeletionTargetType;
  /** Called when the user clicks Confirm. */
  onConfirm: () => void | Promise<void>;
  /** Called when the user dismisses the dialog without confirming. */
  onCancel?: () => void;
}

export function confirmAnnotationsDelete(opts: ConfirmAnnotationsDeleteOptions): void {
  const { count, onConfirm, onCancel, shape, annotation_category } = opts;
  const singular = count === 1;
  const kind = opts.type ?? deletionTargetType(shape);

  showConfirmDialog({
    title:
      opts.title ??
      (kind === "tag"
        ? singular ? "Delete tag" : "Delete tags"
        : singular
          ? "Delete annotation"
          : "Delete all annotations"),

    description:
      opts.description ??
      (singular
        ? shape && annotation_category
          ? `Are you sure you want to delete this ${shape} ${kind} ("${annotation_category}")?`
          : `Are you sure you want to delete this ${kind}?`
        : `Are you sure you want to delete all ${count} selected ${kind}s in this entry?`),

    onConfirm,
    onCancel,
  });
}
