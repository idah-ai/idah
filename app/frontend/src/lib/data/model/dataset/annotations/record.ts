import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";
import type { EntryRecord } from "@/data/model/dataset/entries/record";

@type("dataset:annotations")
export class AnnotationRecord extends Record {
  @field() public shape_type!: string;
  @field() public shape_args!: { [key: string]: unknown };
  @field() public category!: string;
  @field() public properties!: { [key: string]: unknown };

  @field() public deleted_at!: Date | null;
  @field() public deleted_by_id!: string | null;
  @field() public deleted_by_email!: string | null;

  @field() public created_by_id!: string;
  @field() public created_at!: Date;
  @field() public updated_at!: Date;

  @field() public metadata!: { [key: string]: unknown };

  @field() public version!: number;

  @relationship() public entry!: EntryRecord;
}

RecordFactory.registerTypes(AnnotationRecord);

const base_path = `/api/v1/dataset/annotations`;

export const annotationsBackendDataSource = createBackendDataSource(AnnotationRecord, base_path, {
  /**
   * Rebuild an annotation as it was at a past version
   * (GET /annotations/:id/versions/:version). Bypasses the data source cache,
   * like the custom methods of `pluginsBackendDataSource`.
   */
  getVersion: async (id: string, version: number): Promise<AnnotationRecord> => {
    const res = await fetch(`${resourcePath(base_path, id, undefined)}/versions/${version}`, {
      method: "GET",
    });

    const body = await res.json();

    if (body && body.errors) {
      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body && body.data) return Promise.resolve(parseSingleElementReturn<AnnotationRecord>(body).data);

    throw "No body returned";
  },
});
