import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "../Record";
import type { DatasetRecord } from "./datasetRecord";

@type("dataset:entries")
export class EntryRecord extends Record {
  @field() public priority!: number;
  @field() public wf_step!: string;
  @field() public status!: string;
  @field() public resource!: string;
  @field() public assigned_to_id!: string;
  @field() public created_at!: Date;
  @field() public updated_at!: Date;

  @relationship() public dataset!: DatasetRecord;
}

RecordFactory.registerTypes(EntryRecord);

export const entriesBackendDataSource = createBackendDataSource(
  EntryRecord,
  "https://idah.localhost:8443/api/v1/dataset/entries",
);
