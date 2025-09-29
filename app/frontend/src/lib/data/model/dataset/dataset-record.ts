import { createBackendDataSource, resourcePath } from "@/data/BackendDataSource";
import { clearCache } from "@/data/Cache";
import { showErrorToast } from "@/utils/error/error.toasts";
import { parseSingleElementError, parseSingleElementReturn } from "@/data/model/json_api";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";

import { humanize } from "@/utils/string";

import { ProjectRecord } from "@/data/model/dataset/projects/project-record";
import { EntryRecord } from "@/data/model/dataset/entries/record";

import type { Hash } from "@/utils/types";
import type { LabelingConfiguration } from "@/data/model/dataset/labels";
import {
  type DatasetModalityBadgeProps,
  type DatasetStatusBadgeProps,
  datasetsModalities,
  datasetsStatuses,
} from "@/data/model/dataset/datasets/constants";
import { Layers2Icon } from "@lucide/svelte";

@type("dataset:datasets")
export class DatasetRecord extends Record {
  @field() public name!: string;
  @field() public labels!: Array<string>;
  @field() public modality!: string;
  @field() public labeling_configuration!: LabelingConfiguration;
  @field() public workflow_configuration!: Hash;
  @field() public status!: string;
  @field() public progress!: number;
  @field() public updated_at!: Date;
  @field() public created_at!: string;

  @relationship() public project!: ProjectRecord;
  @relationship() public entries!: EntryRecord[];

  public get modalityBadge(): DatasetModalityBadgeProps {
    const defaultBadgeProps: DatasetModalityBadgeProps = {
      label: humanize(this.modality),
      value: this.modality,
      icon: Layers2Icon,
      variant: "outline",
    };

    const foundDatasetModality = datasetsModalities.find((m) => m.value === this.modality);

    return foundDatasetModality ?? defaultBadgeProps;
  }

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

const datasetsBasePath = "https://idah.localhost:8443/api/v1/dataset/datasets"

export const datasetsBackendDataSource = createBackendDataSource(
  DatasetRecord,
  datasetsBasePath,
  {
    import: async (
      file: File,
      projectId: string,
    ): Promise<RecordResponse<DatasetRecord> | JsonApiErrorResponse> => {
      const formData = new FormData();
      formData.append("file", file);
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
    export: async (
      datasetId: string,
    ) => {
      // const formData = new FormData();
      // formData.append("datasetId", datasetId);

      // console.log("datasetId: ", datasetId)

      const exportPath = `${datasetsBasePath}/export/${datasetId}`;

      const out = await fetch(exportPath, {
        method: "GET",
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

      if (body && body.data) return;

      throw "No data returned";
    },
  }
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

export function constructTree(config: LabelingConfiguration) {
  /** Build a nested object structure first */
  const root: Hash = {};

  for (const cat of config.categories) {
    const parts: Array<string> = cat.id.split("/");
    let currentNode = root;
    let parentPath: string | null = null;

    /** Walk through each page segment */
    parts.forEach((part, index) => {
      // Build the current path
      const currentPath = parentPath ? `${parentPath}/${part}` : part;

      /** Create node if it doesn't exist */
      currentNode[part] = currentNode[part] || {
        __data: {
          id: currentPath,
          parent: parentPath,
          type: cat.type,
          label: humanize(part),
          color: cat.color,
          text_color: cat.text_color || "#FFFFFF",
        },
        __children: {},
      };

      /** At the last part, store the category info */
      if (index === parts.length - 1) {
        currentNode[part].__data = {
          id: cat.id,
          parent: parentPath,
          type: cat.type,
          label: cat.label || humanize(part),
          color: cat.color,
          text_color: cat.text_color || "#FFFFFF",
        };
      }

      /** Update parent path for next iteration */
      parentPath = currentPath;

      /** Move to the next level in the tree */
      currentNode = currentNode[part].__children;
    });
  }

  /** Convert the nested object structure to an array */
  function toArray(node: Hash): TreeItem[] {
    return Object.entries(node).map(([key, value]) => ({
      label: key,
      ...value.__data,
      children: toArray(value.__children),
    }));
  }

  return toArray(root);
}
