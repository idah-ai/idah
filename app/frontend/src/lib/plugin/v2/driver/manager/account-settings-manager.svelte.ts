// -----------------------------------------------------------------------
// AccountSettingsManager — loads & persists the current user's account
// settings. It is a generic in-memory store (themes / prefs could live here
// later); today it backs command-palette shortcut overrides.
//
// The shortcut overrides are exposed as a Svelte `$state` object whose
// reference stays stable: it is only ever mutated in place (never reassigned),
// so CommandManagerV2 can hold the same object and read live values, while
// components reading it re-render automatically.
// -----------------------------------------------------------------------
import { SvelteMap } from "svelte/reactivity";
import { accountSettingBackendDataSource, commandShortcutKey } from "@/data/model/setting/account_setting/record";

type SettingValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

export class AccountSettingsManager {
  // All loaded settings, keyed by (plugin, key) → { id, value }. A composite key
  // is required because the same key can appear under several plugins.
  private settings = new SvelteMap<string, { id: string; value: SettingValue }>();

  // Live command-name → shortcut map. SAME reactive object handed to
  // CommandManagerV2. Mutated in place so the reference never changes.
  private overrides = $state<Record<string, string>>({});

  getShortcutOverrides(): Record<string, string> {
    return this.overrides;
  }

  // Composite map key. plugin defaults to "" for core (non-plugin) settings.
  #mapKey(key: string, plugin = ""): string {
    return `${plugin} ${key}`;
  }

  get(key: string, plugin = ""): SettingValue | undefined {
    return this.settings.get(this.#mapKey(key, plugin))?.value;
  }

  // Create-or-update a setting by (key, plugin) and cache the returned record.
  // The single generic write path exposed to plugins and core UI.
  async upsert(key: string, value: SettingValue, plugin = ""): Promise<void> {
    const { data } = await accountSettingBackendDataSource.upsert(key, value, plugin);
    this.settings.set(this.#mapKey(key, plugin), { id: data.id, value: data.value as SettingValue });
  }

  async load(accountId: string): Promise<void> {
    if (!accountId) return;

    const res = await accountSettingBackendDataSource.list({
      filters: { account_id: accountId },
    });

    this.settings.clear();
    for (const rec of res.data) {
      this.settings.set(this.#mapKey(rec.key, rec.plugin), { id: rec.id, value: rec.value as SettingValue });
    }

    this.#syncOverridesFromStore();
  }

  async setShortcut(name: string, shortcut: string): Promise<void> {
    this.overrides[name] = shortcut;
    await this.#persist();
  }

  async resetShortcut(name: string): Promise<void> {
    delete this.overrides[name];
    await this.#persist();
  }

  async resetAll(): Promise<void> {
    this.#clearOverrides();
    await this.#persist();
  }

  // Clear every key in place so the `$state` reference is preserved.
  #clearOverrides(): void {
    for (const key of Object.keys(this.overrides)) delete this.overrides[key];
  }

  #syncOverridesFromStore(): void {
    this.#clearOverrides();

    const value = this.settings.get(this.#mapKey(commandShortcutKey))?.value;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [name, shortcut] of Object.entries(value)) {
        if (typeof shortcut === "string") this.overrides[name] = shortcut;
      }
    }
  }

  async #persist(): Promise<void> {
    // Reuse the generic upsert path (plugin "" for this core setting). Creates
    // the row on first write, updates it after — no account-creation seed needed.
    await this.upsert(commandShortcutKey, { ...this.overrides });
  }
}
