import type { Hash } from "@/utils/types";

/**
 * Tracks whether a form's editable fields differ from the original record.
 *
 * Each modal supplies its own `serialize` (its editable-field list) and a getter
 * for the original record, so the comparison fields stay owned by the modal.
 * Follows the repo's reactive-class pattern (see ListViewController / SidebarState).
 */
export class FormChangeTracker {
  #edited = $state<string | null>(null);
  #saved = $derived.by(() => {
    const original = this.getOriginal();
    return original ? JSON.stringify(this.serialize(original)) : "";
  });

  constructor(
    private readonly serialize: (source: Hash) => Hash,
    private readonly getOriginal: () => Hash | undefined,
  ) {}

  /** True once a change has been recorded and it differs from the original. */
  get hasUnsavedChanges(): boolean {
    return this.#edited !== null && this.#edited !== this.#saved;
  }

  /** Record the current form values (call from the form's onValueChange). */
  update(value: Hash): void {
    this.#edited = JSON.stringify(this.serialize(value));
  }

  /** Clear the changed state (call from resetForm). */
  reset(): void {
    this.#edited = null;
  }
}
