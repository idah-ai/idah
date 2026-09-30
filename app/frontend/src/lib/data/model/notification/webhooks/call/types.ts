import { WebhookCallRecord } from "@/data/model/notification/webhooks/call/record";

import type { BackendDataSource } from "@/data/BackendDataSource";
import type { Hash, LabelValue } from "@/utils/types";

export interface WebhookCallHttpStatus extends LabelValue<number> {
  success: boolean;
  bgColor: string;
}

export type WebhookCallBackendDataSource = BackendDataSource<WebhookCallRecord> & Hash;
