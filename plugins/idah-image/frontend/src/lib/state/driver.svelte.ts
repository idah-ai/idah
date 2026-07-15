// ---------------------------------------------------------------------------
// driver.svelte.ts — Global singleton for the V2 IdahDriver
//
// Must be set via initDriver() at module scope BEFORE any component mounts.
// Not reactive — this is hot before Svelte starts rendering.
//
// NOTE: Keep this file in sync with plugins/idah-video/frontend/src/lib/state/driver.svelte.ts.
// Both plugins should maintain identical sync-state logic.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2, ISyncErrorEvent } from "$idah/v2/types";
import { viewport } from "./viewport.svelte";

let _driver: IIdahDriverV2 | null = null;

let _syncQueued = $state(0);
let _syncError = $state<ISyncErrorEvent | null>(null);

export const syncStatus: {
  queued: number;
  error: ISyncErrorEvent | null;
} = {
  get queued() { return _syncQueued; },
  get error()  { return _syncError; },
};

export function getDriver(): IIdahDriverV2 {
  if (_driver) return _driver;
  throw new Error("Driver not initialized!");
}

export function initDriver(d: IIdahDriverV2): void {
  _driver = d;

  d.onModeChange((ev) => {
    const reactiveViewport = viewport as { mode: string; applyDriverMode?: (mode: string) => void };
    if (reactiveViewport.applyDriverMode) {
      reactiveViewport.applyDriverMode(ev.newValue);
    } else {
      reactiveViewport.mode = ev.newValue;
    }
  });

  // Clear the error banner when the queue drains — this happens naturally
  // after connectivity is restored and the network-error backoff succeeds,
  // or after a core.retry run completes for server errors.
  d.onSyncChange((event) => {
    _syncQueued = event.queued;
    if (event.queued === 0) _syncError = null;
  });

  d.onSyncError((event: ISyncErrorEvent) => {
    _syncError = event;
  });
}

export function retrySync() {
  _syncError = null
  getDriver().command.call("core.retry");
}

export function resetSync() {
  getDriver().command.call("core.reset");
}
