import FilterByWebhookEvents from "@/components/app/notification/webhook/data-tables/filters/_FilterByWebhookEvents.svelte";
import WebhookEnabledCell from "@/components/app/notification/webhook/data-tables/_WebhookEnabledCell.svelte";
import WebhookEventTypesCell from "@/components/app/notification/webhook/data-tables/_WebhookEventTypesCell.svelte";
import WebhookNameCell from "@/components/app/notification/webhook/data-tables/_WebhookNameCell.svelte";
import WebhookRowActionCell from "@/components/app/notification/webhook/data-tables/_WebhookRowActionCell.svelte";
import WebhookUrlCell from "@/components/app/notification/webhook/data-tables/_WebhookUrlCell.svelte";

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
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: WebhookUrlCell,
  },
  events: {
    label: "Event Types",
    dataType: "string",
    clickable: true,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "events",
      filterBy: "datasource",
      filterOperation: "contains",
    },
    visible: true,
    hidable: false,
    filterComponent: FilterByWebhookEvents,
    cellComponent: WebhookEventTypesCell,
  },
  created_at: {
    label: "Created At",
    dataType: "datetime",
    sortable: false,
    filterable: false,
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
      choices: [
        { label: "Enabled", value: true },
        { label: "Disabled", value: false },
      ],
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
