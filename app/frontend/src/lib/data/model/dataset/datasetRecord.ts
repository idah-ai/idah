import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "../Record";
import type { AnnotationRecord } from "./annotationRecord";

@type("dataset:datasets")
export class DatasetRecord extends Record {
  @field() public labels!: Array<string>;
  @field() public modaity!: string;
  @field() public labeling_configuration!: string;
  @field() public workflow_configuration!: string;
  @field() public status!: string;
  @field() public progress!: Date;
  @field() public updated_at!: Date;

  @relationship() public annotations!: AnnotationRecord;
}

RecordFactory.registerTypes(DatasetRecord);

export const entriesJsonApiDataSource = createBackendDataSource(
  DatasetRecord,
  "https://idah.localhost:8443/api/v1/dataset/entries",
);
