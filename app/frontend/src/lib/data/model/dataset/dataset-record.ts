import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { showErrorToast } from "@/utils/error/error.toasts";
import { parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";
import type { Hash } from "@/utils/types";
import type { JsonApiErrorResponse, RecordResponse } from "@/data/model/types";

@type("dataset:datasets")
export class DatasetRecord extends Record {
  @field() public name!: string;
  @field() public labels!: Array<string>;
  @field() public modality!: string;
  @field() public labeling_configuration!: Hash;
  @field() public workflow_configuration!: Hash;
  @field() public status!: string;
  @field() public progress!: Date;
  @field() public updated_at!: Date;
  @field() public created_at!: string;

  @relationship() public project!: ProjectRecord;
}

RecordFactory.registerTypes(DatasetRecord);

const datasetsBasePath = "https://idah.localhost:8443/api/v1/dataset/datasets"

export const datasetsBackendDataSource = createBackendDataSource(
  DatasetRecord,
  datasetsBasePath,
  {
    import: async (
      file: File,
      resource: string,
      projectId: string,
    ): Promise<RecordResponse<DatasetRecord> | JsonApiErrorResponse> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("resource", resource);
      formData.append("project_id", projectId);

      const importPath = `${datasetsBasePath}/import`;

      const out = await fetch(importPath, {
        method: "POST",
        body: formData,
      });

      const body = await out.json();

      // Cache Management
      const cacheIndexKey = resourcePath(datasetsBasePath, null, undefined);
      clearCache(cacheIndexKey);

      if (body && body.errors) {
        if (body.errors.length > 0) {
          body.errors.forEach((err: Hash<string>) => {
            showErrorToast({ title: err.title, message: err.detail, error: err });
          });
        }

        return Promise.reject(parseSingleElementError({ status: out.status, errors: body.errors }));
      }

      if (body && body.data) return Promise.resolve(parseSingleElementReturn<DatasetRecord>(body));

      throw "No data returned";
    },
  }
);
