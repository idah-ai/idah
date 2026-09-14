// ---------------------------------------------------------------------------
// hover.svelte.ts — hovered annotation state
//
// Holds the id of the annotation currently under the cursor, or null.
//
// Mirrors selection.svelte.ts, but keyed by id rather than by record: hover
// changes on every mouse move across shapes and consumers only ever ask
// "is this one hovered?", so there is nothing to gain from holding the record.
//
// Hover is driven by the shapes' own mouseenter/mouseleave on their rendered
// geometry — the same hit region that drives click — so hover and selection
// always agree about which annotation the cursor is on.
// ---------------------------------------------------------------------------

let _hoveredId: string | null = $state(null);

export const hover = {
  get value() {
    return _hoveredId;
  },

  isHovered(annotationId: string): boolean {
    return _hoveredId === annotationId;
  },

  setHovered(annotationId: string): void {
    _hoveredId = annotationId;
  },

  /**
   * Clear the hover, but only if `annotationId` is still the hovered one.
   *
   * Browsers fire mouseenter on the shape being entered before mouseleave on
   * the shape being left when two shapes overlap. An unguarded clear would
   * therefore blank the hover that was just set. Passing the leaving shape's
   * own id makes the late event a no-op.
   */
  clearHovered(annotationId: string): void {
    if (_hoveredId === annotationId) _hoveredId = null;
  },
};
