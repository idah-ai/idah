// ---------------------------------------------------------------------------
// selection.delete — Delete whatever is currently selected
// Undoable: restores the annotation(s).
// Shortcut: Delete / Backspace
// ---------------------------------------------------------------------------
import { selection } from "$lib/state/selection.svelte";
import { data, type AnnotationItem } from "$lib/state/data.svelte";
import type { IIdahDriverV2 } from "$idah/v2/types";
import { noopAction } from "..";
import { isEditable } from "$lib/state/editor.svelte";
import { annotation } from "$lib/state/annotation.svelte";
import { viewport } from "$lib/state/viewport.svelte";
import { showToast } from "$lib/components/ui/Toast/index.svelte";

export const command = {
  name: "selection.delete",
  group: "Selection",
  modes: ["editor"],
  shortcut: "Backspace",
  shortDescription: "Delete selected",
  longDescription: null,
};

export function register(driver: IIdahDriverV2): void {
  driver.command.register({
    name: command.name,
    modes: command.modes,
    shortcut: command.shortcut,
    shortDescription: command.shortDescription,
    longDescription: command.longDescription,
    callback: () => {
      if (!isEditable() || viewport.isReviewWorkspace) return noopAction(command);
      if (!data.annotations) return noopAction(command);

      // ── Resolve records to delete ──────────────────────────────────
      // Collect all selected annotation IDs + all annotations from selected groups.
      const allItems = data.annotations.items;
      const records: AnnotationItem[] = [];

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

      const recordsSnapshot = uniqueRecords;

      return {
        command: { ...command },
        async do() {
          selection.deselect();
          for (const r of recordsSnapshot) {
            await data.annotations!.delete(r.id);
          }
        },
        async undo() {
          if (!data.annotations) return;
          for (const r of recordsSnapshot) {
            // Ensure metadata is always a proper hash — the backend rejects
            // null/undefined metadata.
            const sanitized = { ...r, metadata: (r as any).metadata ?? {} };
            await data.annotations!.create(sanitized);
          }
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
