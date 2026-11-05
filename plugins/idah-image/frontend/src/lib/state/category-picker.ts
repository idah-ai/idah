// ---------------------------------------------------------------------------
// category-picker.ts — Lets commands apply a category the way the sidebar does.
//
// The pending category (what the next drawn annotation gets) lives in the
// workspace component, so the workspace attaches its handler here on mount and
// commands such as category.reuse-last call `apply`.
// ---------------------------------------------------------------------------

/** Applies `category` (of `shapeType`): changes the selection, or picks it for drawing
 *  when nothing is selected. Returns false when it doesn't fit the selection's shape type. */
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
