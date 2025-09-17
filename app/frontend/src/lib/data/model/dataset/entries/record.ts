import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type, relationship } from "@/data/model/Record";
import {
  entryPriorities,
  entryStatuses,
  type EntryPriorityBadgeProps,
  type EntryStatusBadgeProps,
} from "@/data/model/dataset/entries/constants";

import type { DatasetRecord } from "@/data/model/dataset/dataset-record";

@type("dataset:entries")
export class EntryRecord extends Record {
  @field() public dataset_id!: string;

  @field() public priority!: number;

  @field() public wf_step!: string;
  @field() public status!: string;

  @field() public job_id!: string;

  @field() public resource!: string;

  @field() public assigned_to_id!: string;

  @field() public created_at!: Date;
  @field() public updated_at!: Date;

  @relationship() public dataset!: DatasetRecord;

  public get priorityBadge(): EntryPriorityBadgeProps {
    const defaultBadgeProps: EntryPriorityBadgeProps = {
      label: "Medium",
      value: 0,
      variant: "outline",
    };

    const foundEntryPriority = entryPriorities.find((p) => p.value === this.priority);

    return foundEntryPriority ?? defaultBadgeProps;
  }

  public get statusBadge(): EntryStatusBadgeProps {
    const defaultBadgeProps: EntryStatusBadgeProps = {
      label: "Pending",
      value: "pending",
      variant: "outline",
    };

    const foundEntryStatus = entryStatuses.find((s) => s.value === this.status);

    return foundEntryStatus ?? defaultBadgeProps;
  }
}

RecordFactory.registerTypes(EntryRecord);

export const entriesBackendDataSource = createBackendDataSource(
  EntryRecord,
  "https://idah.localhost:8443/api/v1/dataset/entries",
);
