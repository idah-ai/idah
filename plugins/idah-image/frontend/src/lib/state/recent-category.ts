// ---------------------------------------------------------------------------
// recent-category.ts — The category of the annotation the user created last in
// a dataset, for category.reuse-last.
//
// Recorded when an annotation is created, and in the image plugin when painting
// into an existing mask: one mask per category, so painting with a category that
// already has a mask adds to it instead of creating one. Changing the category of
// an existing annotation does not count. It is never read from the records:
// those can come from other annotators, imports or pre-labelling.
//
// Kept in memory only, per dataset. It is forgotten whenever the plugin is
// loaded again: on a reload, and when the entry page is opened again (the core
// loads the plugin with a script tag, and Submit moves to the next entry with a
// full page load).
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";

export type RecentCategory = { category: string; shapeType: string };

const byDataset = new Map<string, RecentCategory>();

function datasetKey(driver: IIdahDriverV2): string {
  return driver.dataset?.id ?? "";
}

export const recentCategory = {
  /** The category created last in this dataset, if any. */
  get(driver: IIdahDriverV2): RecentCategory | undefined {
    const value = byDataset.get(datasetKey(driver));
    return value ? { ...value } : undefined;
  },
  /** Remember `category` (of `shapeType`) as created last in this dataset. */
  record(driver: IIdahDriverV2, category: string | null | undefined, shapeType: string): void {
    if (category) byDataset.set(datasetKey(driver), { category, shapeType });
  },
  /** Forget everything (tests). */
  reset(): void {
    byDataset.clear();
  },
};
