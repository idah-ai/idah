// ---------------------------------------------------------------------------
// driver.svelte.ts — Global singleton for the V2 IdahDriver
//
// Must be set via initDriver() at module scope BEFORE any component mounts.
// Not reactive — this is hot before Svelte starts rendering.
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
    viewport.mode = ev.newValue;
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

// ---------------------------------------------------------------------------
// claimDriverShortcut — let app shortcuts win over a focused widget.
//
// Some focusable widgets (e.g. a bits-ui slider thumb) handle arrow keys
// natively and swallow them before the window-level shortcut handler runs.
// Attach this with `onkeydowncapture` on a container wrapping such a widget:
// it offers each keypress to the driver first, and only when the driver
// claims it as a registered shortcut does it stop the widget from also acting.
// Key/command-agnostic, so it covers current and future shortcuts. Text inputs
// are skipped so typing is never hijacked.
// ---------------------------------------------------------------------------
export function claimDriverShortcut(event: KeyboardEvent): void {
  const el = document.activeElement as HTMLElement | null;
  if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable) return;
  if (getDriver().handleKeydown(event)) {
    event.preventDefault();
    event.stopPropagation();
  }
}
