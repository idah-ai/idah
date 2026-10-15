import type { WebhookCallHttpStatus } from "@/data/model/notification/webhooks/call/types";

export const webhookCallHttpStatuses: WebhookCallHttpStatus[] = [
  {
    label: "Success",
    value: 399,
    success: true,
    bgColor: "green",
  },
  {
    label: "Error",
    value: 400,
    success: false,
    bgColor: "red",
  },
];
