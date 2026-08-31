// ---------------------------------------------------------------------------
// clipboard.svelte.ts — Clipboard for copy/paste of annotations
//
// Stores the raw annotation data of copied annotations so they can be pasted
// with the same category, shape, frame timing, and group structure.
// ---------------------------------------------------------------------------

interface ClipboardAnnotation {
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

export const clipboard = {
  get annotations(): ClipboardAnnotation[] | null {
    return _annotations;
  },
  get centroid(): [number, number] {
    return _centroid;
  },
  get hasData(): boolean {
    return _annotations !== null && _annotations.length > 0;
  },

  store(annotations: ClipboardAnnotation[], centroid: [number, number]): void {
    _annotations = annotations;
    _centroid = centroid;
  },

  clear(): void {
    _annotations = null;
    _centroid = [0, 0];
  },
};
