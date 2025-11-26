import { createBackendDataSource, encodeModel, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { datasetBasePath, DatasetRecord } from "@/data/model/dataset/dataset-record";
import {
  entryPriorities,
  entryStatuses,
  type EntryPriorityBadgeProps,
  type EntryStatus,
  type EntryStatusBadgeProps,
  type EntryWorkflowStep,
} from "@/data/model/dataset/entries/constants";
import { parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";

import type { JsonApiErrorResponse, RecordResponse } from "@/data/model/types";
import type { Hash } from "@/utils/types";

@type("dataset:entries")
export class EntryRecord extends Record {
  @field() public dataset_id!: string;

  @field() public priority!: number;

  @field() public wf_step!: EntryWorkflowStep;
  @field() public status!: EntryStatus;

  @field() public job_id!: string | null;

  @field() public resource!: string;

  @field() public assigned_to_member_id!: number | null;

  @field() public created_at!: Date;
  @field() public updated_at!: Date;

  @relationship() public dataset!: DatasetRecord;

  public get priorityBadge(): EntryPriorityBadgeProps {
    const defaultBadgeProps: EntryPriorityBadgeProps = {
      label: "Medium",
      value: 0,
      variant: "secondary",
      iconColor: "#1E90FF", // DodgerBlue
    };

    const foundEntryPriority = entryPriorities.find((p) => p.value === this.priority);

    return foundEntryPriority ?? defaultBadgeProps;
  }

  public get statusBadge(): EntryStatusBadgeProps {
    const defaultBadgeProps: EntryStatusBadgeProps = {
      label: "Pending",
      value: "pending",
      variant: "warning",
    };

    const foundEntryStatus = entryStatuses.find((s) => s.value === this.status);

    return foundEntryStatus ?? defaultBadgeProps;
  }
}

const entryBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/entries`;

RecordFactory.registerTypes(EntryRecord);

export const entriesBackendDataSource = createBackendDataSource(EntryRecord, entryBasePath, {
  assign: async (params: {
    id: string;
    memberId: number;
  }): Promise<RecordResponse<EntryRecord> | JsonApiErrorResponse> => {
    const res = await fetch(`${entryBasePath}/${params.id}/assign`, {
      method: "PATCH",
      body: encodeModel(EntryRecord, { attributes: { assigned_to_member_id: params.memberId } }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const body = await res.json();

    // Cache Management
    const cacheIndexKey = resourcePath(entryBasePath, null, undefined);
    clearCache(cacheIndexKey);

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error assigning entry: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body && body.data) {
      return Promise.resolve(parseSingleElementReturn<EntryRecord>(body));
    }

    throw "No data returned";
  },
  submit: async (entryId: string, opts?: { approved: boolean }) => {
    const res = await fetch(`${entryBasePath}/${entryId}/submit`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          attributes: {
            approved: opts?.approved || false,
          },
        },
      }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const body = await res.json();

    // Cache Management
    const cacheIndexKey = resourcePath(entryBasePath, null, undefined);
    // Note: Clear dataset cache as well to update progress at DataTable
    const cacheDatasetIndexKey = resourcePath(datasetBasePath, null, undefined);
    clearCache(cacheIndexKey);
    clearCache(cacheDatasetIndexKey);

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error submitting entry: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body && body.data) {
      return Promise.resolve(parseSingleElementReturn<EntryRecord>(body));
    }

    throw "No data returned";
  },
});
