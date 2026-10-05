import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

export const webhookResource = "notification:webhooks" as const;

@type(webhookResource)
export class WebhookRecord extends Record {
  @field() public name!: string;
  @field() public url!: string;
  @field() public event_types!: string[];
  @field() public secret_key!: string;
  @field() public enabled!: boolean;
  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;
}

RecordFactory.registerTypes(WebhookRecord);

export const webhooksBackendDataSource = createBackendDataSource(WebhookRecord, `/api/v1/notification/webhooks`);
