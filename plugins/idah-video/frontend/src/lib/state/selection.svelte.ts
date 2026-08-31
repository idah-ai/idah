// ---------------------------------------------------------------------------
// selection.svelte.ts — Multi-selection state
//
// Replaces the singleton model with a set-based model supporting simultaneous
// annotation and group selection.
//
// Key design decisions:
//   - Store IDs (strings), not object references — objects become stale.
//   - Expose derived values (selectedAnnotations, selectedGroups, etc.)
//   - Backward-compatible `value` getter returns the "primary" (first) selection.
// ---------------------------------------------------------------------------
import type { IAnnotationRecord } from "$idah/v2/types";
import { data } from "$lib/state/data.svelte";

// ── Types (backward-compatible exports) ────────────────────────────────
export interface IAnnotationSelection {
  type: "annotation";
  annotation: IAnnotationRecord;
}

export interface IAnnotationGroupSelection {
  type: "group";
  groupId: string;
}

// ── Internal state ──────────────────────────────────────────────────────
let _selectedAnnotationIds = $state<Set<string>>(new Set());
let _selectedGroupIds = $state<Set<string>>(new Set());

// ── Derived values ──────────────────────────────────────────────────────
function resolveAnnotations(): IAnnotationRecord[] {
  const items = data.annotations?.items ?? [];
  return items.filter((a) => _selectedAnnotationIds.has(a.id)) as IAnnotationRecord[];
}

function resolveGroups(): { groupId: string; annotations: IAnnotationRecord[] }[] {
  const items = data.annotations?.items ?? [];
  return Array.from(_selectedGroupIds).map((gid) => ({
    groupId: gid,
    annotations: items.filter(
      (a) => (a as any).metadata?.group_id === gid || a.id === gid,
    ) as IAnnotationRecord[],
  }));
}

// ── Public API ──────────────────────────────────────────────────────────
export const selection = {
  // ── Backward-compatible getters ─────────────────────────────────────
  /**
   * Returns the "primary" selection (first annotation or first group).
   * Maintains backward compatibility with existing consumers.
   * @deprecated Use isAnnotationSelected / selectedAnnotationIds / selectedGroupIds instead.
   */
  get value(): { type: "annotation"; annotation: IAnnotationRecord } | { type: "group"; groupId: string } | null {
    if (_selectedAnnotationIds.size > 0) {
      const ann = resolveAnnotations()[0];
      if (ann) return { type: "annotation", annotation: ann };
    }
    if (_selectedGroupIds.size > 0) {
      const gid = Array.from(_selectedGroupIds)[0];
      return { type: "group", groupId: gid };
    }
    return null;
  },

  // ── Set-based state access ──────────────────────────────────────────
  get selectedAnnotationIds(): ReadonlySet<string> {
    return _selectedAnnotationIds;
  },

  get selectedGroupIds(): ReadonlySet<string> {
    return _selectedGroupIds;
  },

  get selectedAnnotations(): IAnnotationRecord[] {
    return resolveAnnotations();
  },

  get selectedGroups(): { groupId: string; annotations: IAnnotationRecord[] }[] {
    return resolveGroups();
  },

  /**
   * All individual annotations that belong to the currently selected groups.
   * Useful for displaying group annotations in the selection panel.
   */
  get selectedGroupAnnotations(): IAnnotationRecord[] {
    return resolveGroups().flatMap((g) => g.annotations);
  },

  get selectedCount(): number {
    return _selectedAnnotationIds.size + _selectedGroupIds.size;
  },

  // ── Query methods ───────────────────────────────────────────────────
  hasSelection(): boolean {
    return _selectedAnnotationIds.size > 0 || _selectedGroupIds.size > 0;
  },

  hasGroupSelection(): boolean {
    return _selectedGroupIds.size > 0;
  },

  hasValidSelection(): boolean {
    return _selectedAnnotationIds.size > 0 || _selectedGroupIds.size > 0;
  },

  isAnnotation(): boolean {
    return _selectedAnnotationIds.size > 0;
  },

  isAnnotationGroup(): boolean {
    return _selectedGroupIds.size > 0;
  },

  isAnnotationSelected(annotationId: string): boolean {
    return _selectedAnnotationIds.has(annotationId);
  },

  isGroupSelected(groupId: string): boolean {
    return _selectedGroupIds.has(groupId);
  },

  isGroup(): boolean {
    return _selectedGroupIds.size > 0;
  },

  // ── Mutation methods ────────────────────────────────────────────────
  /**
   * Select a single annotation, replacing any current selection.
   */
  selectAnnotation(annotation: IAnnotationRecord): void {
    _selectedAnnotationIds = new Set([annotation.id]);
    _selectedGroupIds = new Set();
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
    // Clear group selection when toggling annotations
    _selectedGroupIds = new Set();
  },

  /**
   * Select multiple annotations at once (rectangle selection).
   * Replaces any current selection.
   */
  selectAnnotations(annotationIds: string[]): void {
    _selectedAnnotationIds = new Set(annotationIds);
    _selectedGroupIds = new Set();
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

  selectGroup(groupId: string): void {
    _selectedGroupIds = new Set([groupId]);
    _selectedAnnotationIds = new Set();
  },

  /**
   * Toggle a group in/out of the timeline group selection.
   * Unlike selectGroup, this does NOT clear annotation selection —
   * timeline group multi-selection is independent of viewport shapes.
   */
  toggleGroup(groupId: string): void {
    const next = new Set(_selectedGroupIds);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    _selectedGroupIds = next;
  },

  deselect(): void {
    _selectedAnnotationIds = new Set();
    _selectedGroupIds = new Set();
  },
};
