import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import { ExportRecord } from "@/data/model/sync/exports/record";

import type { Hash } from "@/utils/types";

@type("sync:jobs")
export class SyncJobRecord extends Record {
  @field() public job_class!: string;

  @field() public arguments!: Hash;

  @field() public priority!: number;
  @field() public status!: string;
  @field() public progress!: number;

  @field() public retry_count!: number;
  @field() public error!: string;
  @field() public unicity!: string;

  @field({ transformer: Transformers.Time }) public scheduled_at!: Date;
  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;

  @relationship() public exports!: ExportRecord[];
}

RecordFactory.registerTypes(SyncJobRecord);
const syncJobsBasePath = `${import.meta.env.VITE_IDAH_HOST}/api/v1/sync/jobs`;

export const SyncJobsBackendDataSource = createBackendDataSource(SyncJobRecord, syncJobsBasePath);
