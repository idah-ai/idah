import { createBackendDataSource } from "@/data/BackendDataSource";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

@type("notification:webhooks")
export class WebhookRecord extends Record {
  @field() public name!: string;
  @field() public url!: string;
  @field() public event_type!: string;
  @field() public secret_key!: string;
  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;
}

RecordFactory.registerTypes(WebhookRecord);

export const webhooksBackendDataSource = createBackendDataSource(
  WebhookRecord,
  `${import.meta.env.VITE_IDAH_HOST}/api/v1/notification/webhooks`,
);
