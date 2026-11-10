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
// Saved in the browser's localStorage, one key per dataset, so it survives a
// reload and carries over to the next entry. The in-memory copy keeps it working
// when storage is unavailable (private browsing, quota).
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";

export type RecentCategory = { category: string; shapeType: string };

const KEY_PREFIX = "idah-image:recent-category:";
const memory = new Map<string, RecentCategory>();

function keyFor(driver: IIdahDriverV2): string {
  return KEY_PREFIX + (driver.dataset?.id ?? "");
}

function isRecentCategory(value: unknown): value is RecentCategory {
  const v = value as RecentCategory | null | undefined;
  return typeof v?.category === "string" && v.category !== "" && typeof v.shapeType === "string";
}

function readStored(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export const recentCategory = {
  /** The category created last in this dataset, if any. */
  get(driver: IIdahDriverV2): RecentCategory | undefined {
    const key = keyFor(driver);
    const value = memory.get(key) ?? readStored(key);
    return isRecentCategory(value) ? { category: value.category, shapeType: value.shapeType } : undefined;
  },
  /** Remember `category` (of `shapeType`) as created last in this dataset. */
  record(driver: IIdahDriverV2, category: string | null | undefined, shapeType: string): void {
    if (!category) return;
    const key = keyFor(driver);
    const value: RecentCategory = { category, shapeType };
    memory.set(key, value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable: the in-memory copy still works until the page reloads.
    }
  },
  /** Forget the in-memory copies (tests). */
  reset(): void {
    memory.clear();
  },
};
