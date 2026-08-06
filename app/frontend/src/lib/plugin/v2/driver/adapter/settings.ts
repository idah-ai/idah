import type { ISettingGroup, ISettingProvider, ISettingsDriverV2, Unsubscribe } from "../../types";

// ---------------------------------------------------------------------------
// Adapter: settings driver → ISettingsDriverV2
//
// Holds setting providers contributed by the active plugin. Unlike stats there
// are no built-in core settings — every group comes from a plugin. Groups that
// share a `section` are merged so the topbar renders one submenu per section.
//
// `onChange`/`emitChange` let the plugin push value-change notifications to
// core: because the plugin is a separately-loaded bundle (UMD global) with its
// own Svelte runtime, core cannot reactively observe the plugin's state. The
// plugin calls `emitChange()` after any mutation and core re-reads.
// ---------------------------------------------------------------------------
export class SettingsDriverAdapter implements ISettingsDriverV2 {
  private providers: ISettingProvider[] = [];
  private changeListeners = new Set<() => void>();

  register(provider: ISettingProvider): void {
    this.providers.push(provider);
  }

  /**
   * Return a sealed view exposing only the plugin-facing ISettingsDriverV2.
   * `collect`/`onChange` below are core-only and are intentionally absent from
   * the object plugins receive — they reach core via `driver.settingsAdapter`.
   */
  sealed(): ISettingsDriverV2 {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const adapter = this;
    return {
      register: adapter.register.bind(adapter),
      emitChange: adapter.emitChange.bind(adapter),
    };
  }

  /** CORE-ONLY — used by the topbar settings renderer. */
  collect(): ISettingGroup[] {
    const bySection = new Map<string, ISettingGroup>();

    for (const provider of this.providers) {
      for (const group of provider.collect()) {
        const existing = bySection.get(group.section);
        if (existing) {
          existing.items.push(...group.items);
        } else {
          bySection.set(group.section, { section: group.section, items: [...group.items] });
        }
      }
    }

    return [...bySection.values()];
  }

  /** CORE-ONLY — subscribed by the topbar while the settings menu is open. */
  onChange(cb: () => void): Unsubscribe {
    this.changeListeners.add(cb);
    return () => this.changeListeners.delete(cb);
  }

  emitChange(): void {
    for (const cb of this.changeListeners) cb();
  }
}
