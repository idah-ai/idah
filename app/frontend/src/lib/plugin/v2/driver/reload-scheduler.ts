// ---------------------------------------------------------------------------
// reload-scheduler.ts — drain-and-reload scheduling for the IDB driver
//
// When another tab upgrades the local cache database, this tab must reload to
// pick up the new schema — but only after queued backend writes have drained,
// otherwise they would be lost. This module encapsulates that "wait for the
// queue to reach zero, then reload" logic so it is unit-testable without
// constructing the whole IdahDriverV2.
// ---------------------------------------------------------------------------

export interface ReloadSchedulerDeps {
  /** Current number of queued backend writes. */
  pendingCount: () => number;
  /** Subscribe to queue changes; the callback receives the new queued count. */
  onSyncChange: (cb: (queued: number) => void) => () => void;
  /** Perform the reload. */
  reload: () => void;
  /** Called exactly once when a reload is scheduled (e.g. to block new writes). */
  onSchedule: () => void;
}

/**
 * Returns a function that schedules a reload once the queue drains. Calling it
 * again before the reload fires is a no-op (the reload happens at most once).
 */
export function createReloadScheduler(deps: ReloadSchedulerDeps): () => void {
  let scheduled = false;

  return () => {
    if (scheduled) return;
    scheduled = true;
    deps.onSchedule();

    if (deps.pendingCount() === 0) {
      deps.reload();
      return;
    }

    const unsubscribe = deps.onSyncChange((queued) => {
      if (queued === 0) {
        unsubscribe();
        deps.reload();
      }
    });
  };
}
