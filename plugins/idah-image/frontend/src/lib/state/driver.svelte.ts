// ---------------------------------------------------------------------------
// driver.svelte.ts — Global singleton for the V2 IdahDriver
//
// Must be set via initDriver() at module scope BEFORE any component mounts.
// Not reactive — this is hot before Svelte starts rendering.
// ---------------------------------------------------------------------------
import type { IIdahDriverV2, ISyncErrorEvent } from "$idah/v2/types";
import { viewport } from "./viewport.svelte";

let _driver: IIdahDriverV2 | null = null;

// ── Sync queue reactive state ──────────────────────────────────────────
let _syncQueued = $state(0);
let _syncError = $state<{ message: string; code?: string; failedCount?: number } | null>(null);

export const syncStatus: {
  queued: number;
  error: { message: string; code?: string; failedCount?: number } | null;
} = {
  get queued() {
    return _syncQueued;
  },
  get error() {
    return _syncError;
  },
};

export function dismissSyncError(): void {
  _syncError = null;
}

export function getDriver(): IIdahDriverV2 {
  if (_driver) {
    return _driver;
  }
  throw "Driver not initialized!";
}

export function initDriver(d: IIdahDriverV2): void {
  _driver = d;

  // Make mode reactive.
  d.onModeChange((ev) => {
    viewport.mode = ev.newValue;
  });

  // Track sync queue depth.
  d.onSyncChange((event) => {
    _syncQueued = event.queued;
    if (event.queued === 0) _syncError = null;
  });

  // Capture sync errors.
  d.onSyncError((event: ISyncErrorEvent) => {
    _syncError = {
      message: event.message,
      code: event.code,
      failedCount: event.failedCount,
    };
  });
}
