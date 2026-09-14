import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { createBackendDataSource } from "@/data/BackendDataSource";

import type { IConfig } from "@/plugin/v2/types";

@type("dataset:label_config_templates")
export class LabelConfigTemplateRecord extends Record {
  @field() public readonly organization_id!: string;

  @field() public name!: string;
  @field() public labeling_configuration!: IConfig;
  @field() public modality!: string;

  @field() public readonly created_by_id!: string;
  @field() public readonly updated_by_id!: string;

  @field() public readonly created_at!: Date;
  @field() public readonly updated_at!: Date;
}

RecordFactory.registerTypes(LabelConfigTemplateRecord);

export const labelConfigTemplateBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/label_config_templates`;

export const labelConfigTemplateDataSource = createBackendDataSource(
  LabelConfigTemplateRecord,
  labelConfigTemplateBasePath,
);
