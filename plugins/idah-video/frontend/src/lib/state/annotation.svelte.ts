// ---------------------------------------------------------------------------
// annotation.svelte.ts — Reactive visibility & lock state for annotations
//
// Tracks which annotation IDs are currently hidden from the viewport and
// which are locked (non-editable). Both lists are backed by Svelte 5 $state,
// so any component reading `annotation.isHidden(ann)` or
// `annotation.isLocked(ann)` reacts automatically to changes.
//
// Exposed as a plain object with query and mutation methods so components
// use `annotation.toggleHidden(id, flag)` / `annotation.clearHidden()`
// syntax.
// ---------------------------------------------------------------------------

import type { IAnnotationRecord } from "$idah/v2/types";

let hiddenIds: string[] = $state([]);
let lockedIds: string[] = $state([]);

export const annotation = {
  isLocked: (annotation: IAnnotationRecord) => {
    return lockedIds.includes(annotation.id) ||
      (annotation.metadata?.group_id != null && lockedIds.includes(annotation.metadata.group_id));
  },

  isHidden: (annotation: IAnnotationRecord) => {
    return hiddenIds.includes(annotation.id) ||
      (annotation.metadata?.group_id != null && hiddenIds.includes(annotation.metadata.group_id));
  },

  clearLocked: () => {
    lockedIds = [];
  },

  clearHidden: () => {
    hiddenIds = [];
  },

  toggleLocked: (id: string, locked: boolean) => {
    if (locked) {
      if (!lockedIds.includes(id)) lockedIds.push(id);
    } else {
      lockedIds = lockedIds.filter((lockedId) => lockedId !== id);
    }
  },

  toggleHidden: (id: string, hidden: boolean) => {
    if (hidden) {
      if (!hiddenIds.includes(id)) hiddenIds.push(id);
    } else {
      hiddenIds = hiddenIds.filter((hiddenId) => hiddenId !== id);
    }
  },
};