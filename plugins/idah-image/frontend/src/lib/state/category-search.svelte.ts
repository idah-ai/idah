// ---------------------------------------------------------------------------
// category-search.svelte.ts — Shared writable state for the category search field
//
// Components that display or filter annotations based on category
// can read this value and react to changes.
// ---------------------------------------------------------------------------

let _query = $state("");

export const categorySearch = {
  get value(): string {
    return _query;
  },

  set value(v: string) {
    _query = v;
  },

  clear(): void {
    _query = "";
  },
};