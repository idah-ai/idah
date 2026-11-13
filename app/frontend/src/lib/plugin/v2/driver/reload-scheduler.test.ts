import { describe, it, expect, vi } from "vitest";
import { createReloadScheduler, type ReloadSchedulerDeps } from "./reload-scheduler";

function makeDeps(overrides: Partial<ReloadSchedulerDeps> = {}): ReloadSchedulerDeps & {
  listeners: Set<(queued: number) => void>;
} {
  const listeners = new Set<(queued: number) => void>();
  return {
    pendingCount: () => 0,
    onSyncChange: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    reload: vi.fn(),
    onSchedule: vi.fn(),
    listeners,
    ...overrides,
  };
}

function emit(listeners: Set<(queued: number) => void>, queued: number): void {
  for (const cb of listeners) cb(queued);
}

describe("createReloadScheduler", () => {
  it("reloads right away when pendingCount is 0", () => {
    const deps = makeDeps();
    const schedule = createReloadScheduler(deps);

    schedule();

    expect(deps.reload).toHaveBeenCalledTimes(1);
    expect(deps.onSchedule).toHaveBeenCalledTimes(1);
  });

  it("waits until the queue reaches 0 before reloading", () => {
    const deps = makeDeps({ pendingCount: () => 3 });
    const schedule = createReloadScheduler(deps);

    schedule();

    // Not reloaded yet — the queue is still draining.
    expect(deps.reload).not.toHaveBeenCalled();
    expect(deps.onSchedule).toHaveBeenCalledTimes(1);

    // Drain one at a time; still not zero.
    emit(deps.listeners, 2);
    emit(deps.listeners, 1);
    expect(deps.reload).not.toHaveBeenCalled();

    // Reaches zero → reload fires and the listener unsubscribes.
    emit(deps.listeners, 0);
    expect(deps.reload).toHaveBeenCalledTimes(1);

    // A later change must not reload again (unsubscribed).
    emit(deps.listeners, 0);
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it("called twice → reloads once", () => {
    const deps = makeDeps({ pendingCount: () => 1 });
    const schedule = createReloadScheduler(deps);

    schedule();
    schedule();

    expect(deps.onSchedule).toHaveBeenCalledTimes(1);
    expect(deps.reload).not.toHaveBeenCalled();

    emit(deps.listeners, 0);
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });
});
