// ---------------------------------------------------------------------------
// category-picker.ts — Lets commands apply a category the way the sidebar does.
//
// The pending category (what the next drawn annotation gets) lives in the
// workspace component, so the workspace attaches its handler here on mount and
// commands such as category.reuse-last call `apply`.
// ---------------------------------------------------------------------------

/** Picks `category` (of `shapeType`) for the next annotation. Returns false when it is no
 *  longer in the label config. */
export type ApplyCategory = (category: string, shapeType: string) => boolean;

let handler: ApplyCategory | null = null;

export const categoryPicker = {
  /** Attach the workspace's handler. Returns a function that detaches it. */
  attach(fn: ApplyCategory): () => void {
    handler = fn;
    return () => {
      if (handler === fn) handler = null;
    };
  },
  /** Apply a category through the attached workspace. False when no workspace is attached. */
  apply(category: string, shapeType: string): boolean {
    return handler ? handler(category, shapeType) : false;
  },
};
