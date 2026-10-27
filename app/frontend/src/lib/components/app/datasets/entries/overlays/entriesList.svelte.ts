import { ListViewController } from "@/components/app/data-view/list-view-controller.svelte";
import { DatasetRecord } from "@/data/model/dataset/dataset-record";
import { entriesBackendDataSource, type EntryRecord } from "@/data/model/dataset/entries/record";
import { ProjectMemberRecord } from "@/data/model/dataset/projects/members/record";

/**
 * Build the entries list controller for a dataset.
 *
 * Centralizes the entry-specific base config (pinned `dataset_id` filter, included
 * relationships, projected member fields, default sort, storage key and refetch key);
 * all generic list behavior lives in {@link ListViewController}.
 */
export function createEntriesController(datasetId: string): ListViewController<EntryRecord> {
  return new ListViewController<EntryRecord>({
    dataSource: entriesBackendDataSource,
    storageKey: `idah:entries:${datasetId}:viewState`,
    refetchKey: "entries",
    listOptions: {
      filters: { dataset_id: datasetId },
      included: ["assigned_to", "submitted_by", "reviewed_by", "reopened_by", "dataset"],
      fields: { [ProjectMemberRecord.type]: ["name", "email", "picture_url"], [DatasetRecord.type]: ["delivery_date"] },
      sort: ["delivery_date", "priority", "created_at", "id"],
    },
  });
}
