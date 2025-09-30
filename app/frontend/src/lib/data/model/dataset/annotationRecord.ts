import type { AnnotationShape, AnnotationValue } from "@/context/AnnotationContext";
import { field, Record, RecordFactory, relationship, type } from "../Record";
import { createBackendDataSource } from "@/data/BackendDataSource";
import type { EntryRecord } from "@/data/model/dataset/entries/record";

@type("dataset:annotations")
export class AnnotationRecord extends Record {
  @field() public dimensions!: AnnotationShape;
  @field() public annotation!: AnnotationValue;

  @field() public created_by_id!: string;
  @field() public created_at!: Date;
  @field() public updated_at!: Date;

  @relationship() public entry!: EntryRecord;
}

RecordFactory.registerTypes(AnnotationRecord);

export const annotationsBackendDataSource = createBackendDataSource(
  AnnotationRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/annotations`,
);
