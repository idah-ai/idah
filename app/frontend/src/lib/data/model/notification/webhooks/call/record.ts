import { webhookCallHttpStatuses } from "@/data/model/notification/webhooks/call/constants";
import { field, Record, RecordFactory, type } from "@/data/model/Record";
import { Transformers } from "@/data/model/transformers";

import type { WebhookCallHttpStatus } from "@/data/model/notification/webhooks/call/types";

@type("notification:jobs")
export class WebhookCallRecord extends Record {
  @field() public readonly status!: string;
  @field() public readonly retry_count!: number;
  @field() public readonly error!: string | null;
  @field() public readonly webhook_id!: number;
  @field() public readonly http_code!: number | null;
  @field() public readonly response!: string | null;
  @field({ transformer: Transformers.Time }) public created_at!: Date;
  @field({ transformer: Transformers.Time }) public updated_at!: Date;

  public get httpStatus(): WebhookCallHttpStatus {
    if (this.status === "pending" || this.status === "running") {
      return webhookCallHttpStatuses.find((status) => status.value === this.status)!;
    }
    if (this.status === "errored") return webhookCallHttpStatuses[1];
    if (this.http_code == null) {
      return { label: "No response", value: "unknown", success: null, bgColor: "gray" };
    }
    if (this.http_code >= 200 && this.http_code < 300) {
      return webhookCallHttpStatuses[0];
    }

    return webhookCallHttpStatuses[1];
  }
}

RecordFactory.registerTypes(WebhookCallRecord);
