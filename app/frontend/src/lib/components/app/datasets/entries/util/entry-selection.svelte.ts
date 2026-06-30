import { SvelteMap } from "svelte/reactivity";

import type { ListViewController } from "@/components/app/data-view/list-view-controller.svelte";
import type { EntryRecord } from "@/data/model/dataset/entries/record";

/**
 * Entry-specific derivations on top of a generic {@link ListViewController}.
 *
 * Keeps domain rules (assignable / unassignable based on `wf_step` and `assigned_to_id`,
 * name lookups) out of the generic controller so the controller stays reusable.
 */
export class EntrySelection {
  constructor(private readonly controller: ListViewController<EntryRecord>) {}

  /** O(1) lookup map — avoids O(n×m) scans in selection filters. */
  entryMap: Map<string, EntryRecord> = $derived(new SvelteMap(this.controller.response.data.map((e) => [e.id, e])));

  /** Selected entries that can be assigned (not already in the "done" step). */
  assignableEntryIds: string[] = $derived(
    this.controller.selectedIds.filter((id) => this.entryMap.get(id)?.wf_step !== "done"),
  );

  /** Selected entries that can be unassigned (not done and currently assigned). */
  unAssignableEntryIds: string[] = $derived(
    this.controller.selectedIds.filter((id) => {
      const e = this.entryMap.get(id);
      return e?.wf_step !== "done" && e?.assigned_to_id !== null;
    }),
  );

  checkAnyAssigned(ids: string[]): boolean {
    return ids.some((id) => !!this.entryMap.get(id)?.assigned_to_id);
  }

  getEntryName(id: string): string | undefined {
    return this.entryMap.get(id)?.name;
  }
}
