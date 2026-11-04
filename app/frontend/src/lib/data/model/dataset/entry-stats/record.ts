import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import { EntryRecord } from "@/data/model/dataset/entries/record";

@type("dataset:entry_stats")
export class EntryStatRecord extends Record {
  @field() public readonly entry_id!: string;

  @field() public key!: string;
  @field() public value!: string;

  @field({ transformer: Transformers.Time }) public readonly created_at!: Date;
  @field({ transformer: Transformers.Time }) public readonly updated_at!: Date;

  @relationship() public entry!: EntryRecord;
}

RecordFactory.registerTypes(EntryStatRecord);

export const entryStatsBasePath: string = `/api/v1/dataset/entry_stats`;

export const entryStatBackendDataSource = createBackendDataSource(EntryStatRecord, entryStatsBasePath);
