import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";

@type("sync:jobs")
export class SyncJobRecord extends Record {
  @field() public status!: string;
  @field() public progress!: number;
  // @relationship() public entry!: EntryRecord;
}

RecordFactory.registerTypes(SyncJobRecord);
const syncJobsBasePath = `${import.meta.env.VITE_IDAH_HOST}/api/v1/sync/jobs`;

export const SyncJobsBackendDataSource = createBackendDataSource(SyncJobRecord, syncJobsBasePath);
