// ---------------------------------------------------------------------------
// recent-category.ts — The category of the annotation the user created last,
// for category.reuse-last.
//
// Recorded when an annotation is created, and in the image plugin when painting
// into an existing mask: one mask per category, so painting with a category that
// already has a mask adds to it instead of creating one. Changing the category of
// an existing annotation does not count. It is never read from the records:
// those can come from other annotators, imports or pre-labelling.
//
// Kept in memory only. It is forgotten whenever the plugin is loaded again: on a
// reload, and when the entry page is opened again (the core loads the plugin
// with a script tag, and Submit moves to the next entry with a full page load).
// ---------------------------------------------------------------------------

export type RecentCategory = { category: string; shapeType: string };

let recent: RecentCategory | undefined;

export const recentCategory = {
  /** The category created last, if any. */
  get(): RecentCategory | undefined {
    return recent ? { ...recent } : undefined;
  },
  /** Remember `category` (of `shapeType`) as created last. */
  record(category: string | null | undefined, shapeType: string): void {
    if (category) recent = { category, shapeType };
  },
  /** Forget it (tests). */
  reset(): void {
    recent = undefined;
  },
};
