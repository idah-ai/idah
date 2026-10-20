import WebhookCallCreatedAtCell from "@/components/app/notification/webhook/call/data-tables/_WebhookCallCreatedAtCell.svelte";
import WebhookCallHttpStatusCell from "@/components/app/notification/webhook/call/data-tables/_WebhookCallHttpStatusCell.svelte";
import { webhookCallHttpStatuses } from "@/data/model/notification/webhooks/call/constants";

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
  status: {
    label: "HTTP Status",
    dataType: "string",
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "status",
      filterBy: "multiple-select",
      filterOperation: "in",
      choices: webhookCallHttpStatuses,
    },
    visible: true,
    hidable: false,
    cellComponent: WebhookCallHttpStatusCell,
  },
};
