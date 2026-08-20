// -----------------------------------------------------------------------
// AccountSettingsManager (mock) — in-memory version of the CORE manager.
//
// The real CORE manager loads & persists the current user's account settings
// from the backend. This mock keeps everything in memory: there is no backend
// in the /mock harness, so `load()` is a no-op and nothing is persisted. The
// point is to exercise the reactive override → palette → dispatch flow.
//
// The shortcut overrides are exposed as a Svelte `$state` object whose
// reference stays stable: it is only ever mutated in place (never reassigned),
// so CommandManagerV2 can hold the same object and read live values, while
// components reading it re-render automatically.
// -----------------------------------------------------------------------
import type { IAccountSettingsDriverV2 } from "$idah/v2/types";

export class AccountSettingsManager implements IAccountSettingsDriverV2 {
  // Live command-name → shortcut map. SAME reactive object handed to
  // CommandManagerV2. Mutated in place so the reference never changes.
  private overrides = $state<Record<string, string>>({});

  getShortcutOverrides(): Record<string, string> {
    return this.overrides;
  }

  get(_key: string): unknown {
    // Mock: no generic settings store.
    return undefined;
  }

  // Mock: nothing to load — overrides start empty and live only in memory.
  async load(_accountId: string): Promise<void> {}

  async setShortcut(name: string, shortcut: string): Promise<void> {
    this.overrides[name] = shortcut;
  }

  async resetShortcut(name: string): Promise<void> {
    delete this.overrides[name];
  }

  async resetAll(): Promise<void> {
    this.#clearOverrides();
  }

  // Clear every key in place so the `$state` reference is preserved.
  #clearOverrides(): void {
    for (const key of Object.keys(this.overrides)) delete this.overrides[key];
  }
}
