import { showToast } from "@/components/ui/toast/index.svelte";
import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
import { showActionFailedToast } from "@/utils/error/error.toasts";

import type { EntryRecord } from "@/data/model/dataset/entries/record";
import type { JsonApiErrorResponse, RecordResponse } from "@/data/model/types";

/**
 * Narrow successful mutation responses. The data source resolves to a union
 * (`RecordResponse | JsonApiErrorResponse`) but rejects before resolving on
 * errors, so the success path only ever contains data-bearing responses.
 */
function unwrapResponses(results: Array<RecordResponse<EntryRecord> | JsonApiErrorResponse>): EntryRecord[] {
  return results.filter((r): r is RecordResponse<EntryRecord> => "data" in r).map((r) => r.data);
}

/**
 * Unassign entries in parallel.
 * Returns the updated records on success, null on failure (toast already shown).
 */
export async function unAssignEntries(
  entryIds: string[],
  getEntryName: (id: string) => string | undefined,
): Promise<EntryRecord[] | null> {
  try {
    const results = await Promise.all(entryIds.map((id) => entriesBackendDataSource.unassign(id)));

    const updatedEntries = unwrapResponses(results);
    const count = updatedEntries.length;
    const description =
      count > 1
        ? `${count} entries have been unassigned.`
        : `The entry "${getEntryName(entryIds[0])}" has been unassigned.`;

    showToast.success({ title: "Entry unassigned", description });
    return updatedEntries;
  } catch (error) {
    showActionFailedToast(error);
    return null;
  }
}

/**
 * Delete entries in parallel (fixes the original sequential loop).
 * Returns true on success, false on failure (toast already shown).
 */
export async function deleteEntries(
  entryIds: string[],
  getEntryName: (id: string) => string | undefined,
): Promise<boolean> {
  try {
    await Promise.all(entryIds.map((id) => entriesBackendDataSource.delete(id, { showErrorToast: false })));

    const count = entryIds.length;
    const description =
      count > 1 ? `${count} entries have been deleted.` : `The entry "${getEntryName(entryIds[0])}" has been deleted.`;

    showToast.success({ title: "Entry deleted", description });
    return true;
  } catch (error) {
    showToast.error({
      title: "Unable to delete entry",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      description: (error as any)?.errors?.[0]?.detail || "The action could not be completed, please try again later.",
    });
    return false;
  }
}

/**
 * Reopen completed entries in parallel.
 * Returns the updated records on success, null on failure (toast already shown).
 * The target stage label comes from the requested target_step.
 */
export async function reopenEntries(entryIds: string[], targetStep: string): Promise<EntryRecord[] | null> {
  try {
    const results = await Promise.all(entryIds.map((id) => entriesBackendDataSource.reopen(id, { targetStep })));

    const updatedEntries = unwrapResponses(results);
    const count = updatedEntries.length;
    const stageLabel = targetStep.charAt(0).toUpperCase() + targetStep.slice(1);
    const description = count > 1 ? `${count} entries moved to ${stageLabel}.` : `Entry moved to ${stageLabel}.`;

    showToast.success({ title: "Entry reopened", description });
    return updatedEntries;
  } catch (error) {
    showActionFailedToast(error);
    return null;
  }
}
