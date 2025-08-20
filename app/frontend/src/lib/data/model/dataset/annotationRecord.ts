import type { AnnotationShape, AnnotationValue } from "@/context/AnnotationContext";
import { field, Record, RecordFactory, type } from "../Record";
import { createBackendDataSource } from "@/data/BackendDataSource";

// @type('annotation')
// export class AnnotationRecord extends Record {
//     @field() public shape!: AnnotationShape
//     @field() public value!: AnnotationValue
//     @field() public metadata!: AnnotationMetadata
// }

@type("dataset:annotations")
export class AnnotationRecord extends Record {
  @field() public dimensions!: AnnotationShape;
  @field() public annotation!: AnnotationValue;

  @field() public created_by_id!: string;
  @field() public created_at!: Date;
  @field() public updated_at!: Date;
}

RecordFactory.registerTypes(AnnotationRecord);

export const annotationsBackendDataSource = createBackendDataSource(
  AnnotationRecord,
  "https://idah.localhost:8443/api/v1/dataset/annotations",
);
