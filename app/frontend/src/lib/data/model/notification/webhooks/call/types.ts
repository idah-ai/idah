import type { WebhookCallRecord } from "@/data/model/notification/webhooks/call/record";

import type { BackendDataSource } from "@/data/BackendDataSource";
import type { Hash, LabelValue } from "@/utils/types";

export type WebhookCallHttpStatusBgColor = "green" | "red" | "gray" | "blue";

export interface WebhookCallHttpStatus extends LabelValue<string> {
  success: boolean | null;
  bgColor: WebhookCallHttpStatusBgColor;
}

export type WebhookCallBackendDataSource = BackendDataSource<WebhookCallRecord> & Hash;
