import WebhookUrlCell from "@/components/app/notification/webhook/data-tables/webhook-url-cell.svelte";

import { WebhookRecord } from "@/data/model/notification/webhooks/record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const webhookCallLogsColumns: ColumnsSettings<WebhookRecord> = {
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
  },
  url: {
    label: "HTTP Status",
    dataType: "string",
    clickable: true,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "url",
      filterBy: "string",
      filterOperation: "match",
    },
    visible: true,
    hidable: false,
    cellComponent: WebhookUrlCell,
  },
};
