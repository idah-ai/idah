import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import type { Hash } from "@/utils/types";

@type("media:jobs")
export class JobRecord extends Record {
  @field() public job_class!: string;

  @field() public arguments!: Hash;

  @field() public priority!: number;
  @field() public status!: "pending" | "running" | "completed" | "errored";
  @field() public progress!: number;

  @field() public retry_count!: number;

  @field() public error!: string;
  @field() public unicity!: string;

  @field({ transformer: Transformers.Time }) public readonly scheduled_at!: Date;

  @field({ transformer: Transformers.Time }) public readonly created_at!: Date;
  @field({ transformer: Transformers.Time }) public readonly updated_at!: Date;
}

const jobBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/media/jobs`;

RecordFactory.registerTypes(JobRecord);

export const jobsBackendDataSource = createBackendDataSource(JobRecord, jobBasePath, {});
