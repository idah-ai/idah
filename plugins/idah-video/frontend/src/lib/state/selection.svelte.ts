// ---------------------------------------------------------------------------
// selection.svelte.ts — unified selection state
//
// Holds either a single annotation or a group identifier.
// ---------------------------------------------------------------------------
import type { IAnnotationRecord } from "$idah/v2/types";

export interface IAnnotationSelection {
  type: "annotation";
  annotation: IAnnotationRecord;
}

export interface IAnnotationGroupSelection {
  type: "group";
  groupId: string;
}

let _selected: IAnnotationSelection | IAnnotationGroupSelection | null = $state(null);

export const selection = {
  get value() {
    return _selected;
  },

  hasSelection(): boolean {
    return _selected !== null;
  },

  hasGroupSelection(): boolean {
    return _selected !== null && _selected.type === "group";
  },

  hasValidSelection(): boolean {
    return _selected !== null &&
      (_selected.type === "group" || _selected.type === "annotation");
  },

  isAnnotation(): boolean {
    return _selected?.type === "annotation";
  },

  isAnnotationGroup(): boolean {
    return _selected?.type === "group";
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
