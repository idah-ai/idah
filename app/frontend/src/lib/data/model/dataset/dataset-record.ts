import { Layers2Icon } from "@lucide/svelte";

import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";

import { humanize } from "@/utils/string";

import { EntryRecord } from "@/data/model/dataset/entries/record";
import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

import {
  type DatasetModalityBadgeProps,
  type DatasetStatusBadgeProps,
  datasetsModalities,
  datasetsStatuses,
} from "@/data/model/dataset/datasets/constants";
import type { LabelConfigurations } from "@/data/model/dataset/labels";
import type { Hash } from "@/utils/types";

@type("dataset:datasets")
export class DatasetRecord extends Record {
  @field() public name!: string;
  @field() public labels!: Array<string>;
  @field() public modality!: string;
  @field() public labeling_configuration!: LabelConfigurations;
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

export const datasetsBackendDataSource = createBackendDataSource(
  DatasetRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/datasets`,
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
