// ---------------------------------------------------------------------------
// entry-root.svelte.ts — Shared entry root annotation state
//
// An annotation with shape.type === "entry:root" holds entry-level
// category/properties (scene-level classification).
//
// Exposed as a writable store so components can use $entryRoot syntax.
// ---------------------------------------------------------------------------

import { writable } from "svelte/store";

export const entryRoot = writable<any | undefined>(undefined);
