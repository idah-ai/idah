import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { createBackendDataSource } from "@/data/BackendDataSource";

/** One change entry: [op, path, old, new] as recorded by the backend. */
export type AnnotationChangeEntry = ["+" | "-" | "~", string, unknown, unknown];

@type("dataset:annotation_changes")
export class AnnotationChangeRecord extends Record {
  @field() public annotation_id!: string;
  @field() public entry_id!: string;
  @field() public project_id!: string;
  @field() public account_id!: number | null;

  @field() public op!: "created" | "updated" | "deleted" | "restored";
  @field() public version!: number;
  @field() public changes!: AnnotationChangeEntry[];

  @field() public changed_at!: Date;
}

RecordFactory.registerTypes(AnnotationChangeRecord);

export const annotationChangesBackendDataSource = createBackendDataSource(
  AnnotationChangeRecord,
  `/api/v1/dataset/annotation_changes`,
);
