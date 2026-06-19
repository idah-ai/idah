// ---------------------------------------------------------------------------
// entry-root.svelte.ts — Shared entry root annotation state
//
// An annotation with shape.type === "entry:root" holds entry-level
// category/properties (scene-level classification).
//
// Exposed as a Svelte 5 rune-based object so components can use
// `entryRoot.value` syntax.
// ---------------------------------------------------------------------------

let _entryRoot: any | undefined = $state(undefined);

export const entryRoot: { value: any | undefined } = {
  get value() { return _entryRoot; },
  set value(v: any | undefined) { _entryRoot = v; },
};
