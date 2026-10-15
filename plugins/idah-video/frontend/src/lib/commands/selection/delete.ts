// ---------------------------------------------------------------------------
// idah-video:selection.delete — Delete whatever is currently selected
// (annotations, or all annotations of a selected group)
// Undoable: restores the annotation(s).
// Shortcut: Delete / Backspace
//
// Confirmation gate: the command owns the "are you sure?" dialog. The shortcut,
// the command palette and the timeline "Delete annotation" context action
// invoke this command with no options, which opens the shared confirm dialog.
// The dialog's onConfirm re-invokes the command with `{ skipConfirm: true }`
// to perform the actual — still undoable — delete.
//
// Callers that already show their own confirmation dialog (e.g. the timeline
// group context menu) MUST pass `{ skipConfirm: true }` to avoid a second
// dialog. Callers that do not confirm call without options and get the gate.
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { data, type AnnotationItem } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";
import { annotation } from "$lib/state/annotation.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { showToast } from "$lib/components/ui/Toast/index.svelte";
import { confirmAnnotationsDelete } from "$lib/components/App/ConfirmDialog/confirm-delete";
import { humanize } from "$lib/utils/string";

export const command = {
  name: "idah-video:selection.delete",
  group: "Selection",
  modes: ["editor"],
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

      // ── Resolve records to delete ────────────────────────────────────
      const allItems = data.annotations.items;
      const records: AnnotationItem[] = [];

      // Confirm re-entry: the id snapshot captured when the dialog opened is
      // authoritative (covers both annotations and group members).
      if (props.ids?.length) {
        for (const annId of props.ids) {
          const rec = allItems.find((a) => a.id === annId);
          if (rec) records.push(rec as AnnotationItem);
        }
      } else {
        // From selected annotation IDs
        for (const annId of selection.selectedAnnotationIds) {
          const rec = allItems.find((a) => a.id === annId);
          if (rec) records.push(rec as AnnotationItem);
        }

        // From selected group IDs
        for (const gid of selection.selectedGroupIds) {
          const groupRecords = allItems.filter(
            (ann) => (ann as any).metadata?.group_id === gid || ann.id === gid,
          );
          for (const r of groupRecords) {
            if (!records.some((existing) => existing.id === r.id)) {
              records.push(r as AnnotationItem);
            }
          }
        }
      }

      // Deduplicate
      const uniqueRecords = Array.from(new Map(records.map((r) => [r.id, r])).values());
      if (uniqueRecords.length === 0) return noopAction(command);

      // Block deletion if any member annotation belongs to a locked group.
      if (uniqueRecords.some((r) => annotation.isLocked(r))) {
        showToast.warning({
          title: "Cannot delete annotation",
          description: "One or more selected annotations are locked.",
        });
        return noopAction(command);
      }

      if (props.skipConfirm !== true) {
        if (confirmActive) return noopAction(command);
        confirmActive = true;

        const annotation = uniqueRecords.length === 1 ? uniqueRecords[0] : undefined;
        const shape = annotation?.shape_type
          ? humanize(
              annotation.shape_type.replace("idah-video:", ""),
              {
                capitalize: false,
                capitalizeFirstWord: false,
              },
            )
          : "uncategorized";
        const annotationCategory = typeof annotation?.category === "string" ? humanize(annotation.category) : undefined;
        confirmAnnotationsDelete({
          count: uniqueRecords.length,
          shape,
          annotation_category: annotationCategory,
          onConfirm: () => {
            confirmActive = false;
            driver.command.call(command.name, {
              skipConfirm: true,
              ids: uniqueRecords.map((r) => r.id),
            });
          },
          onCancel: () => {
            confirmActive = false;
          },
        });
        return noopAction(command);
      }

      const recordsSnapshot = uniqueRecords;

      return {
        command: { ...command },
        async do() {
          selection.deselect();
          const present = recordsSnapshot.filter((r) =>
            data.annotations!.items.some((a) => a.id === r.id),
          );
          await Promise.all(present.map((r) => data.annotations!.delete(r.id)));
        },
        async undo() {
          if (!data.annotations) return;
          const missing = recordsSnapshot.filter(
            (r) => !data.annotations!.items.some((a) => a.id === r.id),
          );
          await Promise.all(missing.map((r) => data.annotations!.restore(r)));
        },
        isCombinable() {
          return false;
        },
        combine(p) {
          return p;
        },
      };
    },
    group: command.group,
    activeWhen: () => selection.hasSelection(),
  });
}
