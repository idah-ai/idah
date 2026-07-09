import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { createBackendDataSource } from "@/data/BackendDataSource";

import type { IConfig } from "@/plugin/v2/types";

@type("dataset:labeling_configuration_templates")
export class LabellingConfigurationTemplateRecord extends Record {
  @field() public readonly organization_id!: string;

  @field() public name!: string;
  @field() public labeling_configuration!: IConfig;
  @field() public modality!: string;

  @field() public readonly created_by_id!: string;
  @field() public readonly updated_by_id!: string;

  @field() public readonly created_at!: Date;
  @field() public readonly updated_at!: Date;
}

RecordFactory.registerTypes(LabellingConfigurationTemplateRecord);

export const labellingConfigurationTemplateBasePath: string = `${import.meta.env.VITE_IDAH_HOST}/api/v1/dataset/labeling_configuration_templates`;

export const labellingConfigurationTemplateDataSource = createBackendDataSource(
  LabellingConfigurationTemplateRecord,
  labellingConfigurationTemplateBasePath,
);
