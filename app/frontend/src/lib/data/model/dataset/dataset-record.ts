import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";

import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";
import type { Hash } from "@/utils/types";
import type { LabelingConfiguration } from "@/data/model/dataset/types";
import { humanize } from "@/utils/string";

@type("dataset:datasets")
export class DatasetRecord extends Record {
  @field() public name!: string;
  @field() public labels!: Array<string>;
  @field() public modality!: string;
  @field() public labeling_configuration!: LabelingConfiguration;
  @field() public workflow_configuration!: Hash;
  @field() public status!: string;
  @field() public progress!: Date;
  @field() public updated_at!: Date;
  @field() public created_at!: string;

  @relationship() public project!: ProjectRecord;
}

RecordFactory.registerTypes(DatasetRecord);

export const datasetsBackendDataSource = createBackendDataSource(
  DatasetRecord,
  "https://idah.localhost:8443/api/v1/dataset/datasets",
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
