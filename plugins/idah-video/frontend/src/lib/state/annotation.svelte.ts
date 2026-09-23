// ---------------------------------------------------------------------------
// annotation.svelte.ts — Reactive visibility & lock state for annotations
//
// Tracks which annotation IDs are currently hidden from the viewport and
// which are locked (non-editable). Both are backed by a Svelte 5 reactive
// `SvelteSet`, so any component reading `annotation.isHidden(ann)` or
// `annotation.isLocked(ann)` reacts automatically to changes.
//
// Sets (rather than arrays) give O(1) membership tests and mutations, so
// bulk operations over many annotations (e.g. hide-all / lock-all on 10k+
// items) stay linear instead of degrading to O(n²).
//
// Exposed as a plain object with query and mutation methods so components
// use `annotation.toggleHidden(id, flag)` / `annotation.clearHidden()`
// syntax.
// ---------------------------------------------------------------------------

import { SvelteSet } from "svelte/reactivity";

import type { IAnnotationRecord } from "$idah/v2/types";

const hiddenIds = new SvelteSet<string>();
const lockedIds = new SvelteSet<string>();

export const annotation = {
  isLocked: (target: IAnnotationRecord | string) => {
    if (typeof target === "string") return lockedIds.has(target);

    return (
      lockedIds.has(target.id) ||
      (target.metadata?.group_id != null && lockedIds.has(target.metadata.group_id))
    );
  },

  isHidden: (target: IAnnotationRecord | string) => {
    if (typeof target === "string") return hiddenIds.has(target);

    return (
      hiddenIds.has(target.id) ||
      (target.metadata?.group_id != null && hiddenIds.has(target.metadata.group_id))
    );
  },

  clearLocked: () => {
    lockedIds.clear();
  },

  clearHidden: () => {
    hiddenIds.clear();
  },

  toggleLocked: (id: string, locked: boolean) => {
    if (locked) lockedIds.add(id);
    else lockedIds.delete(id);
  },

  toggleHidden: (id: string, hidden: boolean) => {
    if (hidden) hiddenIds.add(id);
    else hiddenIds.delete(id);
  },
};
