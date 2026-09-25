import WebhookEnabledCell from "@/components/app/notification/webhook/data-tables/webhook-enabled-cell.svelte";
import WebhookEventTypesCell from "@/components/app/notification/webhook/data-tables/webhook-event-types-cell.svelte";
import WebhookNameCell from "@/components/app/notification/webhook/data-tables/webhook-name-cell.svelte";
import WebhookRowActionCell from "@/components/app/notification/webhook/data-tables/webhook-row-action-cell.svelte";
import WebhookUrlCell from "@/components/app/notification/webhook/data-tables/webhook-url-cell.svelte";

import { WebhookRecord } from "@/data/model/notification/webhooks/record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const webhookColumns: ColumnsSettings<WebhookRecord> = {
  name: {
    label: "Name",
    dataType: "string",
    clickable: true,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "name",
      filterBy: "string",
      filterOperation: "match",
    },
    visible: true,
    hidable: false,
    cellComponent: WebhookNameCell,
  },
  url: {
    label: "URL",
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
  event_type: {
    label: "Event Type",
    dataType: "string",
    clickable: true,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "event_type",
      filterBy: "string",
      filterOperation: "match",
    },
    visible: true,
    hidable: false,
    cellComponent: WebhookEventTypesCell,
  },
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
  enabled: {
    label: "Status",
    dataType: "boolean",
    clickable: true,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "enabled",
      filterBy: "boolean",
      filterOperation: "eq",
    },
    visible: true,
    hidable: false,
    cellComponent: WebhookEnabledCell,
  },
  action: {
    label: "Action",
    dataType: "string",
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: WebhookRowActionCell,
  },
};
