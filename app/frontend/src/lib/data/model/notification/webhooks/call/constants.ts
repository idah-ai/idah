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
  { label: "Pending", value: "pending", success: null, bgColor: "gray" },
  { label: "Running", value: "running", success: null, bgColor: "blue" },
];
