import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import type { ExportRecord } from "../exports/record";

@type("sync:jobs")
export class SyncJobRecord extends Record {
  @field() public status!: string;
  @field() public progress!: number;
  @field() public arguments!: object;
  @relationship() public exports!: ExportRecord[];
}

RecordFactory.registerTypes(SyncJobRecord);
const syncJobsBasePath = `${import.meta.env.VITE_IDAH_HOST}/api/v1/sync/jobs`;

export const SyncJobsBackendDataSource = createBackendDataSource(SyncJobRecord, syncJobsBasePath);
