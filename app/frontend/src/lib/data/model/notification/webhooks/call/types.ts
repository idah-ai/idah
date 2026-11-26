import type { LabelValue } from "@/utils/types";

export type WebhookCallHttpStatusBgColor = "green" | "red" | "gray" | "blue";

export interface WebhookCallHttpStatus extends LabelValue<string> {
  bgColor: WebhookCallHttpStatusBgColor;
}
