import type { WebhookCallHttpStatus } from "@/data/model/notification/webhooks/call/types";

export const webhookCallHttpStatuses: WebhookCallHttpStatus[] = [
  {
    label: "Success",
    value: "completed",
    success: true,
    bgColor: "green",
  },
  {
    label: "Error",
    value: "errored",
    success: false,
    bgColor: "red",
  },
];
