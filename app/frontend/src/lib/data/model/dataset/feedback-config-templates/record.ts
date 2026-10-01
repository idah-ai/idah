import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { createBackendDataSource } from "@/data/BackendDataSource";
import { Transformers } from "@/data/model/transformers";

export interface IFeedbackItem {
  label: string;
  description: string | null;
}

export interface IFeedbackConfig {
  [key: string]: IFeedbackItem;
}

@type("dataset:feedback_config_templates")
export class FeedbackConfigTemplateRecord extends Record {
  @field() readonly organization_id!: string;

  @field() public name!: string;
  @field() public feedback_configuration!: IFeedbackConfig;
  @field() public modality!: string;

  @field() public readonly created_by_id!: string;
  @field() public readonly updated_by_id!: string;

  @field({ transformer: Transformers.Time }) public readonly created_at!: Date;
  @field({ transformer: Transformers.Time }) public readonly updated_at!: Date;
}

RecordFactory.registerTypes(FeedbackConfigTemplateRecord);

export const feedbackTemplateBasePath: string = `/api/v1/dataset/feedback_config_templates`;

export const feedbackConfigTemplateDataSource = createBackendDataSource(
  FeedbackConfigTemplateRecord,
  feedbackTemplateBasePath,
);
