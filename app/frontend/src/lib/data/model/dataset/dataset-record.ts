import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { showErrorToast } from "@/utils/error/error.toasts";

import { EntryRecord } from "@/data/model/dataset/entries/record";
import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

import { type DatasetStatusBadgeProps, datasetsStatuses } from "@/data/model/dataset/datasets/constants";
import type { DataSourceOptions } from "@/data/DataSource";
import type { RecordResponse } from "@/data/model/types";

import type { Hash } from "@/utils/types";
import type { IConfig } from "@/plugin/v2/types";

@type("dataset:datasets")
export class DatasetRecord extends Record {
  @field() public name!: string;
  @field() public labels!: Array<string>;
  @field() public modality!: string;
  @field() public labeling_configuration!: IConfig;
  @field() public workflow_configuration!: Hash;
  @field() public status!: string;
  @field() public progress!: number;
  @field() public entries_total_count!: number;
  @field() public updated_at!: Date;
  @field() public created_at!: string;

  @relationship() public project!: ProjectRecord;
  @relationship() public entries!: EntryRecord[];

  public get statusBadge(): DatasetStatusBadgeProps {
    const defaultBadgeProps: DatasetStatusBadgeProps = {
      label: "Pending",
      value: "pending",
      variant: "outline",
    };

    const foundDatasetStatus = datasetsStatuses.find((s) => s.value === this.status);

    return foundDatasetStatus ?? defaultBadgeProps;
  }
}

RecordFactory.registerTypes(DatasetRecord);

export const datasetBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/datasets`;

interface DatasetsCustomMethods {
  duplicate(id: string, payload?: Hash, options?: DataSourceOptions): Promise<RecordResponse<DatasetRecord>>;
}

export const datasetsBackendDataSource = createBackendDataSource<DatasetRecord, DatasetsCustomMethods>(
  DatasetRecord,
  datasetBasePath,
  {
    async duplicate(id: string, payload?: Hash, options?: DataSourceOptions): Promise<RecordResponse<DatasetRecord>> {
      // Cache Management
      const cacheIndexKey = resourcePath(datasetBasePath, null, undefined);
      clearCache(cacheIndexKey);

      const out = await fetch(`${resourcePath(datasetBasePath, id)}/duplicate`, {
        method: "POST",
        body: payload ? JSON.stringify(payload) : undefined,
        headers: { "Content-Type": "application/json" },
      });

      const body = await out.json();

      if (body && body.errors) {
        if (body.errors.length > 0 && options?.showErrorToast !== false) {
          body.errors.forEach((err: Hash<string>) => {
            showErrorToast({ title: err.title, message: err.detail, error: err });
          });
        }

        return Promise.reject(parseSingleElementError({ status: out.status, errors: body.errors }));
      }

      if (body && body.data) return Promise.resolve(parseSingleElementReturn<DatasetRecord>(body));

      throw "No body returned";
    },
  },
);

export interface TreeItem {
  id: string;
  parent: string | null;
  type: string;
  label: string;
  color: string;
  text_color?: string;
  children: TreeItem[];
}
