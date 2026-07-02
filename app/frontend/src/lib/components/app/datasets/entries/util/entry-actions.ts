import { showToast } from "@/components/ui/toast/index.svelte";
import { entriesBackendDataSource } from "@/data/model/dataset/entries/record";
import { showActionFailedToast } from "@/utils/error/error.toasts";

import type { EntryRecord } from "@/data/model/dataset/entries/record";

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

    const updatedEntries = results.map((r) => r.data);
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
