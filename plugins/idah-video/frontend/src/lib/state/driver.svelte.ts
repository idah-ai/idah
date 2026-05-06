// ---------------------------------------------------------------------------
// driver.svelte.ts — Global singleton for the V2 IdahDriver
//
// Set once when the plugin mounts. Every component can import and read it.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";

export let driver: IIdahDriverV2 | null = $state(null);

export function initDriver(d: IIdahDriverV2): void {
  if (driver) throw new Error("Driver already initialized — call initDriver once");
  driver = d;
}
