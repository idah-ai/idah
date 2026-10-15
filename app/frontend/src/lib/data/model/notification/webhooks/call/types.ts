import { WebhookCallRecord } from "@/data/model/notification/webhooks/call/record";

import type { BackendDataSource } from "@/data/BackendDataSource";
import type { Hash, LabelValue } from "@/utils/types";

export interface WebhookCallHttpStatus extends LabelValue<string> {
  success: boolean | null;
  bgColor: string;
}

export type WebhookCallBackendDataSource = BackendDataSource<WebhookCallRecord> & Hash;
