import { SvelteMap } from "svelte/reactivity";

import type { WebhookCallHttpStatus } from "@/data/model/notification/webhooks/call/types";

export const fallbackWebhookHttpStatus: WebhookCallHttpStatus = {
  label: "No response",
  value: "unknown",
  success: null,
  bgColor: "gray",
};

export const webhookCallHttpStatuses = new SvelteMap<string, WebhookCallHttpStatus>([
  [
    "completed",
    {
      label: "Success",
      value: "completed",
      success: true,
      bgColor: "green",
    },
  ],
  [
    "errored",
    {
      label: "Error",
      value: "errored",
      success: false,
      bgColor: "red",
    },
  ],
  ["pending", { label: "Pending", value: "pending", success: null, bgColor: "gray" }],
  ["running", { label: "Running", value: "running", success: null, bgColor: "blue" }],
]);
