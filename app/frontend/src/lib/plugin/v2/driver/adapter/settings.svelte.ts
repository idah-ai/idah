import { SvelteMap } from "svelte/reactivity";
import type { ISettingGroup, ISettingProvider, ISettingsDriverV2 } from "../../types";

// ---------------------------------------------------------------------------
// Adapter: settings driver → ISettingsDriverV2
//
// Holds setting providers contributed by the active plugin. Unlike stats there
// are no built-in core settings — every group comes from a plugin. Groups that
// share a `section` are merged so the topbar renders one submenu per section.
//
// A plugin is a separately-loaded bundle (UMD global) running its own Svelte
// runtime, so core cannot reactively observe the plugin's setting state: values
// live in the plugin's own `$state`, and core reading them through `item.get()`
// registers no dependency. The plugin therefore PUSHES a signal — `invalidate()`
// — after any mutation, and core re-reads.
//
// That signal is the `revision` counter below, the same mechanism (and name)
// the toolbar submodule uses (see ToolbarManagerV2.invalidate / `driver.toolbar.revision`).
// `revision` is a core-owned `$state`, so the bump happens entirely inside
// core's own runtime — nothing reactive crosses the bundle boundary, only a
// plain method call. Core's renderer reads `revision` inside a `$derived`,
// which is all it takes to make Svelte re-run it; no listener bookkeeping.
// (This file is `.svelte.ts` because `$state` only compiles in that extension.)
// ---------------------------------------------------------------------------
export class SettingsDriverAdapter implements ISettingsDriverV2 {
  private providers: ISettingProvider[] = [];

  /**
   * Monotonically increasing counter, bumped by `invalidate()` whenever a
   * setting value may have changed. CORE-ONLY: the topbar settings renderer
   * reads this inside a `$derived` so its value mirror re-evaluates.
   */
  revision = $state(0);

  register(provider: ISettingProvider): void {
    this.providers.push(provider);
  }

  /**
   * Return a sealed view exposing only the plugin-facing ISettingsDriverV2.
   * `collect`/`revision` are core-only and are intentionally absent from the
   * object plugins receive — core reaches them via `driver.settingsAdapter`.
   */
  sealed(): ISettingsDriverV2 {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const adapter = this;
    return {
      register: adapter.register.bind(adapter),
      invalidate: adapter.invalidate.bind(adapter),
    };
  }

  /** CORE-ONLY — used by the topbar settings renderer. */
  collect(): ISettingGroup[] {
    const bySection = new SvelteMap<string, ISettingGroup>();

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

  invalidate(): void {
    this.revision++;
  }
}
