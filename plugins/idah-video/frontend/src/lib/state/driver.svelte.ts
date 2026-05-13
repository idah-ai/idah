// ---------------------------------------------------------------------------
// driver.svelte.ts — Global singleton for the V2 IdahDriver
//
// Must be set via initDriver() at module scope BEFORE any component mounts.
// Not reactive — this is hot before Svelte starts rendering.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2 } from "$idah/v2/types";
import { viewport } from "./viewport.svelte";

let _driver: IIdahDriverV2 | null = null;

export function getDriver(): IIdahDriverV2 {
  if (_driver) { return _driver; }
  throw 'Driver not initialized!';
}

export function initDriver(d: IIdahDriverV2): void {
  _driver = d;
  // Make mode reactive.
  _driver.onModeChange((ev) => {
    viewport.mode = ev.newValue;
  })
}
