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
import {
  accountSettingBackendDataSource,
  commandShortcutKey,
} from "@/data/model/setting/account_setting/record";

type SettingValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

export class AccountSettingsManager {
  // All loaded settings, keyed by setting key → { id (for updates), value }.
  private settings = new SvelteMap<string, { id: string; value: SettingValue }>();

  // Live command-name → shortcut map. SAME reactive object handed to
  // CommandManagerV2. Mutated in place so the reference never changes.
  private overrides = $state<Record<string, string>>({});

  getShortcutOverrides(): Record<string, string> {
    return this.overrides;
  }

  get(key: string): SettingValue | undefined {
    return this.settings.get(key)?.value;
  }

  async load(accountId: string): Promise<void> {
    if (!accountId) return;

    const res = await accountSettingBackendDataSource.list({
      filters: { account_id: accountId },
    });

    this.settings.clear();
    for (const rec of res.data) {
      this.settings.set(rec.key, { id: rec.id, value: rec.value as SettingValue });
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

    const value = this.settings.get(commandShortcutKey)?.value;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [name, shortcut] of Object.entries(value)) {
        if (typeof shortcut === "string") this.overrides[name] = shortcut;
      }
    }
  }

  async #persist(): Promise<void> {
    const row = this.settings.get(commandShortcutKey);
    if (!row) return; // seeded by account-creation defaults / backfill migration

    const value = { ...this.overrides }; // plain snapshot for serialization
    row.value = value;
    await accountSettingBackendDataSource.update(row.id, { attributes: { value } });
  }
}
