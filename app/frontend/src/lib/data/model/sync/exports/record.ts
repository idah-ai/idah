import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";
import { Transformers } from "@/data/model/transformers";

import { SyncJobRecord } from "@/data/model/sync/jobs/record";

import type { ExportFormat } from "@/data/model/sync/exports/type";
import type { Hash } from "@/utils/types";

@type("sync:exports")
export class ExportRecord extends Record {
  @field() public job_id!: string;
  @field() public project_id!: string;
  @field() public created_by_id!: number;

  @field() public file_id!: string | null;
  @field() public filename!: string | null;
  @field() public mime_type!: string | null;
  @field() public size!: number;

  @field({ transformer: Transformers.Time }) public created_at!: Date;

  @relationship() public job!: SyncJobRecord[];
}

RecordFactory.registerTypes(ExportRecord);

export const exportsBasePath = `${import.meta.env.VITE_IDAH_HOST}/api/v1/sync/exports`;

export const ExportsBackendDataSource = createBackendDataSource(ExportRecord, exportsBasePath, {
  formats: async (params: { modalities: Array<string> }): Promise<Array<ExportFormat>> => {
    const modalitiesQuery = params.modalities.map((modality) => `modalities[]=${modality}`).join("&");
    const res = await fetch(`${exportsBasePath}/formats?${modalitiesQuery}`, {
      method: "GET",
    });

    const body = await res.json();

    return body as Array<ExportFormat>;
  },
  export: async (params: { projectId: string; datasetIds: Array<string>; exporter: string; includeMedias: string }) => {
    const { projectId, datasetIds, exporter, includeMedias } = params;
    const res = await fetch(`${exportsBasePath}/export`, {
      method: "POST",
      body: JSON.stringify({
        project_id: projectId,
        dataset_ids: datasetIds,
        exporter: exporter,
        options: {
          include_medias: includeMedias,
        },
      }),
      headers: { "Content-Type": "application/vnd.api+json" },
    });

    const body = await res.json();

    // Cache Management
    const cacheIndexKey = resourcePath(exportsBasePath, null, undefined);
    clearCache(cacheIndexKey);

    if (body && body.errors) {
      if (body.errors.length > 0) {
        body.errors.forEach((err: Hash) => {
          console.error(`Error assigning entry: ${err.title} - ${err.detail}`, err);
        });
      }

      return Promise.reject(parseSingleElementError({ status: res.status, errors: body.errors }));
    }

    if (body.data) return Promise.resolve(parseSingleElementReturn<ExportRecord>(body));

    throw "No data returned";
  },
});
