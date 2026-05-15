// ---------------------------------------------------------------------------
// selection.svelte.ts — unified selection state
//
// Holds either a single annotation or a group identifier.
// ---------------------------------------------------------------------------
import type { IAnnotationRecord } from "$idah/v2/types";

let _selected: { type: "annotation"; annotation: IAnnotationRecord } | { type: "group"; groupId: string } | null =
  $state(null);

export const selection = {
  get value() {
    return _selected;
  },

  hasSelection(): boolean {
    return _selected !== null;
  },

  isAnnotation(): boolean {
    return _selected?.type === "annotation";
  },

  isAnnotationSelected(annotationId: string): boolean {
    return _selected?.type === "annotation" && _selected.annotation.id === annotationId;
  },

  isGroup(): boolean {
    return _selected?.type === "group";
  },

  selectAnnotation(annotation: IAnnotationRecord): void {
    _selected = { type: "annotation", annotation };
  },

  selectGroup(groupId: string): void {
    _selected = { type: "group", groupId };
  },

  deselect(): void {
    _selected = null;
  },
};
