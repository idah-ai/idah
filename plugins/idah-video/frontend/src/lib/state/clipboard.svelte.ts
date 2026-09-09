// ---------------------------------------------------------------------------
// clipboard.svelte.ts — Clipboard for copy/paste of annotations
//
// Stores the raw annotation data of copied annotations so they can be pasted
// with the same category, shape, frame timing, and group structure.
// ---------------------------------------------------------------------------

/**
 * What the copy was made from. A selection is either a group selection or an
 * annotation selection, never both (see selection.svelte.ts), so this is one
 * value for the whole clipboard.
 *   "group"      — whole groups were selected (a track copy).
 *   "annotation" — annotations were selected individually.
 * Paste reads this back to restore the same kind of selection.
 */
export type ClipboardSelectionKind = "group" | "annotation";

export interface ClipboardAnnotation {
  shape: Record<string, unknown>;
  value: Record<string, unknown> | undefined;
  metadata: Record<string, unknown> | undefined;
  /** Centroid-relative offset in normalized coords. */
  centroidOffset: [number, number];
  /** Original group id (used to re-group pasted annotations). */
  groupId: string;
}

let _annotations: ClipboardAnnotation[] | null = $state(null);
let _centroid: [number, number] = $state([0, 0]);
let _copyFrame: number = $state(0);
let _selectionKind: ClipboardSelectionKind = $state("annotation");

export const clipboard = {
  get annotations(): ClipboardAnnotation[] | null {
    return _annotations;
  },
  get centroid(): [number, number] {
    return _centroid;
  },
  get copyFrame(): number {
    return _copyFrame;
  },
  get hasData(): boolean {
    return _annotations !== null && _annotations.length > 0;
  },
  /** What this copy was made from. Null when the clipboard is empty. */
  get selectionKind(): ClipboardSelectionKind | null {
    return _annotations?.length ? _selectionKind : null;
  },

  store(
    annotations: ClipboardAnnotation[],
    centroid: [number, number],
    copyFrame: number,
    selectionKind: ClipboardSelectionKind,
  ): void {
    _annotations = annotations;
    _centroid = centroid;
    _copyFrame = copyFrame;
    _selectionKind = selectionKind;
  },

  clear(): void {
    _annotations = null;
    _centroid = [0, 0];
    _copyFrame = 0;
    _selectionKind = "annotation";
  },
};
