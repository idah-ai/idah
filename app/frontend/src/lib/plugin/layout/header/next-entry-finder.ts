import { entriesBackendDataSource, EntryRecord } from "@/data/model/dataset/entries/record";
import type { EntryWorkflowStep } from "@/data/model/dataset/entries/constants";

/**
 * Finds the next entry to redirect to after submission.
 * Returns the entry ID if found, or null to fall back to default behavior.
 */
export async function findNextEntry(params: {
  datasetId: string;
  submittedEntryWfStep: EntryWorkflowStep;
}): Promise<string | null> {
  const { datasetId, submittedEntryWfStep } = params;

  try {
    const res = await entriesBackendDataSource.list({
      fields: { [EntryRecord.type]: ["id"] },
      filters: { dataset_id: datasetId, wf_step: submittedEntryWfStep },
      noCache: true,
      pagination: { page: 1, itemsPerPage: 1 },
      sort: ["assigned_to_id"],
    });
    return res.data.length > 0 ? res.data[0].id : null;
  } catch {
    return null;
  }
}
