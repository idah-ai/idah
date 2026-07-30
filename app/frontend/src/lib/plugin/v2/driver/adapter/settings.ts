import type { ISettingGroup, ISettingProvider, ISettingsDriverV2 } from "../../types";

// ---------------------------------------------------------------------------
// Adapter: settings driver → ISettingsDriverV2
//
// Holds setting providers contributed by the active plugin. Unlike stats there
// are no built-in core settings — every group comes from a plugin. Groups that
// share a `section` are merged so the topbar renders one submenu per section.
// ---------------------------------------------------------------------------
export class SettingsDriverAdapter implements ISettingsDriverV2 {
  private providers: ISettingProvider[] = [];

  register(provider: ISettingProvider): void {
    this.providers.push(provider);
  }

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
}
