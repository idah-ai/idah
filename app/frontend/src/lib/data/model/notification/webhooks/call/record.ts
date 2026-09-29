import { createBackendDataSource } from "@/data/BackendDataSource";
import { webhookCallHttpStatuses } from "@/data/model/notification/webhooks/call/constants";
import { WebhookRecord } from "@/data/model/notification/webhooks/record";
import { field, Record, RecordFactory, relationship, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import type { WebhookCallBackendDataSource, WebhookCallHttpStatus } from "@/data/model/notification/webhooks/call/types";

@type("notification:webhook:calls")
export class WebhookCallRecord extends Record {
  @field() public readonly http_code!: number;
  @field() public readonly headers!: string;
  @field() public readonly body!: string[];
  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;

  @relationship() public webhook!: WebhookRecord;

   public get httpStatus(): WebhookCallHttpStatus {
    if (this.http_code > 0 && this.http_code <= 400) {
      return webhookCallHttpStatuses[0];
    }

    return webhookCallHttpStatuses[1];
  }
}

RecordFactory.registerTypes(WebhookCallRecord);

const webhookCallBasePath = (webhookId: string) => `/api/v1/notification/webhook/${webhookId}/calls`;

export const webhookCallBackendDataSource = (webhookId: string): WebhookCallBackendDataSource =>  createBackendDataSource(
  WebhookCallRecord,
  webhookCallBasePath(webhookId),
);

