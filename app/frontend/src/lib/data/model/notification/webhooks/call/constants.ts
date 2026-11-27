import { SvelteMap } from "svelte/reactivity";

import type { WebhookCallHttpStatus } from "@/data/model/notification/webhooks/call/types";

export const fallbackWebhookHttpStatus: WebhookCallHttpStatus = {
  label: "No response",
  value: "unknown",
  bgColor: "gray",
};

export const webhookCallHttpStatuses = new SvelteMap<string, WebhookCallHttpStatus>([
  [
    "completed",
    {
      label: "Success",
      value: "completed",
      bgColor: "green",
    },
  ],
  [
    "errored",
    {
      label: "Error",
      value: "errored",
      bgColor: "red",
    },
  ],
  ["pending", { label: "Pending", value: "pending", bgColor: "gray" }],
  ["running", { label: "Running", value: "running", bgColor: "blue" }],
]);
