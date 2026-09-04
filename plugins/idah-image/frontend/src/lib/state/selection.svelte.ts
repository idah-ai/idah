// ---------------------------------------------------------------------------
// selection.svelte.ts — unified selection state
//
// Holds a single annotation, or null if nothing is selected.
// ---------------------------------------------------------------------------
import type { IAnnotationRecord } from "$idah/v2/types";
import { data } from "$lib/state/data.svelte";

// let _selected: IAnnotationRecord | null = $state(null);

// ── Internal state ──────────────────────────────────────────────────────
let _selectedAnnotationIds = $state<Set<string>>(new Set());

// ── Derived values ──────────────────────────────────────────────────────
function resolveAnnotations(): IAnnotationRecord[] {
  const items = data.annotations?.items ?? [];
  return items.filter((a) => _selectedAnnotationIds.has(a.id)) as IAnnotationRecord[];
}

// ── Public API ──────────────────────────────────────────────────────────
export const selection = {
  // get value() {
  //   return _selected;
  // },
  // ── Backward-compatible getters ─────────────────────────────────────
  /**
   * Returns the "primary" selection (first annotation).
   * Maintains backward compatibility with existing consumers.
   * @deprecated Use isAnnotationSelected / selectedAnnotationIds  instead.
   */
  get value(): IAnnotationRecord | null {
    if (_selectedAnnotationIds.size > 0) {
      const ann = resolveAnnotations()[0];
      if (ann) return ann;
    }
    return null;
  },

    // ── Set-based state access ──────────────────────────────────────────
  get selectedAnnotationIds(): ReadonlySet<string> {
    return _selectedAnnotationIds;
  },

  get selectedAnnotations(): IAnnotationRecord[] {
    return resolveAnnotations();
  },

    get selectedCount(): number {
    return _selectedAnnotationIds.size;
  },

  // ── Query methods ───────────────────────────────────────────────────
  hasSelection(): boolean {
    return _selectedAnnotationIds.size > 0;
  },


  isAnnotationSelected(annotationId: string): boolean {
    return  _selectedAnnotationIds.has(annotationId);
  },

  // ── Mutation methods ────────────────────────────────────────────────
  /**
   * Select a single annotation, replacing any current selection.
   */
  selectAnnotation(annotation: IAnnotationRecord): void {
    _selectedAnnotationIds = new Set([annotation.id]);
    _selectedAnnotationIds.add(annotation.id);
  },

   /**
   * Toggle an annotation in/out of the selection (Shift+Click).
   * If no annotation is currently selected, selects it.
   * If it's already selected, removes it.
   * If other annotations are selected, toggles this one.
   */
  toggleAnnotation(annotationId: string): void {
    const next = new Set(_selectedAnnotationIds);
    if (next.has(annotationId)) {
      next.delete(annotationId);
    } else {
      next.add(annotationId);
    }
    _selectedAnnotationIds = next;
  },

  /**
   * Select multiple annotations at once (rectangle selection).
   * Replaces any current selection.
   */
  selectAnnotations(annotationIds: string[]): void {
    _selectedAnnotationIds = new Set(annotationIds);
  },

  /**
   * Add annotations to the current selection without clearing it.
   */
  addAnnotations(annotationIds: string[]): void {
    const next = new Set(_selectedAnnotationIds);
    for (const id of annotationIds) {
      next.add(id);
    }
    _selectedAnnotationIds = next;
  },

  /**
   * Remove a single annotation from the selection.
   */
  deselectAnnotation(annotationId: string): void {
    const next = new Set(_selectedAnnotationIds);
    next.delete(annotationId);
    _selectedAnnotationIds = next;
  },

  deselect(): void {
    if (_selectedAnnotationIds.size === 0) return;
    _selectedAnnotationIds = new Set();
  },
};
