// ---------------------------------------------------------------------------
// idah-image:selection.delete — Delete whatever is currently selected
// Undoable: restores the annotation(s).
// Shortcut: Backspace
//
// Confirmation gate: the command owns the "are you sure?" dialog. The shortcut
// and the command palette invoke this command with no options, which opens the
// shared confirm dialog. The dialog's onConfirm re-invokes the command with
// `{ skipConfirm: true }` to perform the actual — still undoable — delete.
//
// Any caller that already shows its own confirmation dialog MUST pass
// `{ skipConfirm: true }` to avoid a second dialog. Callers that do not confirm
// call without options and get the gate for free.
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { data, type AnnotationItem } from "$lib/state/data.svelte";
import { isEditable } from "$lib/state/editor.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { DEFAULT_MODE, IMAGE_MASK } from "$lib/types";
import { viewport } from "$lib/state/viewport.svelte";
import { invalidateAll } from "$lib/mask/tile-cache";
import { annotation } from "$lib/state/annotation.svelte";
import { showToast } from "$lib/components/ui/Toast/index.svelte";
import { showConfirmDeleteAnnotationsDialog } from "$lib/components/App/ConfirmDialog/confirm-delete";
import { humanize } from "$lib/utils/string";

export const command = {
  name: "idah-image:selection.delete",
  group: "Selection",
  modes: [DEFAULT_MODE],
  shortcut: "Backspace",
  shortDescription: "Delete selected",
  longDescription: null,
};

export interface SelectionDeleteOptions {
  /** Skip the confirmation gate. Callers that already confirmed MUST pass this. */
  skipConfirm?: boolean;
  /** Ids captured when the confirmation dialog was opened (deterministic re-entry). */
  ids?: string[];
}

export function register(driver: IIdahDriverV2): void {
  // Guards against re-entrancy while the confirmation dialog is already open
  // (e.g. Backspace spam, a palette re-trigger, or a double invocation). The
  // guard is released when the dialog is dismissed — onConfirm *or* onCancel —
  // so a cancelled delete doesn't wedge the next invocation.
  let confirmActive = false;

  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: (opts?: Record<string, unknown>) => {
      if (!isEditable() || viewport.isReviewWorkspace) return noopAction(command);
      if (!data.annotations) return noopAction(command);

      const props = (opts ?? {}) as SelectionDeleteOptions;

      // Resolve the records: explicit id snapshot (confirm re-entry) or the
      // current selection (shortcut / palette).
      const selected: AnnotationItem[] = props.ids?.length
        ? (props.ids
            .map((id) => data.annotations!.items.find((a) => a.id === id))
            .filter(Boolean) as AnnotationItem[])
        : (selection.selectedAnnotations as AnnotationItem[]);

      if (selected.length === 0) return noopAction(command);

      // Parity with idah-image:annotation.delete and the list menus — locked
      // annotations can never be deleted through this command.
      if (selected.some((item) => annotation.isLocked(item))) {
        showToast.warning({
          title: "Cannot delete annotation",
          description: "One or more selected annotations are locked.",
        });
        return noopAction(command);
      }

      // Confirmation gate — the dialog performs the delete only after the user
      // confirms, by re-invoking this command with `{ skipConfirm: true }`.
      if (props.skipConfirm !== true) {
        if (confirmActive) return noopAction(command);
        confirmActive = true;

        const annotation = selected.length === 1 ? selected[0] : undefined;
        const shape = annotation?.shape_type
          ? humanize(annotation.shape_type.replace("idah-image:", ""))
          : "uncategorized";
        const annotationCategory = typeof annotation?.category === "string" ? humanize(annotation.category) : undefined;

        showConfirmDeleteAnnotationsDialog({
          count: selected.length,
          shape,
          annotation_category: annotationCategory,
          onConfirm: () => {
            confirmActive = false;
            driver.command.call(command.name, {
              skipConfirm: true,
              ids: selected.map((r) => r.id),
            });
          },
          onCancel: () => {
            // Dialog dismissed without confirming (Cancel / Escape / …) —
            // release the guard so the next invocation reopens the dialog.
            confirmActive = false;
          },
        });
        return noopAction(command);
      }

      // ── Real, undoable action ──────────────────────────────────────────
      const records = selected;
      return {
        command: { ...command },
        async do() {
          selection.deselect();
          // Free cached mask bitmaps if any are mask annotations
          for (const record of records) {
            if (record.shape_type === IMAGE_MASK) invalidateAll(record.id);
          }
          // Delete only records still present in the store — idempotent
          // against double-fire and redo replays.
          const present = records.filter((r) => data.annotations!.items.some((a) => a.id === r.id));
          await Promise.all(present.map((r) => data.annotations!.delete(r.id)));
        },
        async undo() {
          if (!data.annotations) return;
          // Restore only records not already present — idempotent undo.
          const missing = records.filter((r) => !data.annotations!.items.some((a) => a.id === r.id));
          await Promise.all(missing.map((record) => data.annotations!.restore(record)));
        },
        isCombinable() { return false; },
        combine(p) { return p; },
      };
    },
    group: command.group,
    activeWhen: () => selection.hasSelection(),
  });
}
