// ---------------------------------------------------------------------------
// selection.svelte.ts — unified selection state
//
// Holds a single annotation, or null if nothing is selected.
// ---------------------------------------------------------------------------
import type { IAnnotationRecord } from "$idah/v2/types";

let _selected: IAnnotationRecord | null = $state(null);

export const selection = {
  get value() {
    return _selected;
  },

  hasSelection(): boolean {
    return _selected !== null;
  },

  isAnnotationSelected(annotationId: string): boolean {
    return _selected?.id === annotationId;
  },

  selectAnnotation(annotation: IAnnotationRecord): void {
    _selected = annotation;
  },

  deselect(): void {
    _selected = null;
  },
};
