import WebhookCallCreatedAtCell from "@/components/app/notification/webhook/call/data-tables/webhook-call-created-at-cell.svelte";
import WebhookCallHttpStatusCell from "@/components/app/notification/webhook/call/data-tables/webhook-call-http-status-cell.svelte";

import { WebhookCallRecord } from "@/data/model/notification/webhooks/call/record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const webhookCallLogsColumns: ColumnsSettings<WebhookCallRecord> = {
  created_at: {
    label: "Created At",
    dataType: "datetime",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "created_at",
      filterBy: "date-range",
      filterOperation: "gte",
    },
    visible: true,
    hidable: false,
    cellComponent: WebhookCallCreatedAtCell,
  },
  http_status: {
    label: "HTTP Status",
    dataType: "string",
    clickable: true,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "http_status",
      filterBy: "string",
      filterOperation: "match",
    },
    visible: true,
    hidable: false,
    cellComponent: WebhookCallHttpStatusCell,
  },
};
