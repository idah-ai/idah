import LogActionCell from "@/components/app/audit/audits/datasource-tables/log-action-cell.svelte";
import LogActorAccountCell from "@/components/app/audit/audits/datasource-tables/log-actor-account-cell.svelte";
import LogTimestampCell from "@/components/app/audit/audits/datasource-tables/log-timestamp-cell.svelte";
import FilterByAccount from "@/components/app/datasource-table/filters/filter-by-account.svelte";

import { LogRecord } from "@/data/model/audit/logs/record";

import { logActions, logResourceTypes } from "@/data/model/audit/logs/constants";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const logColumns: ColumnsSettings<LogRecord> = {
  event_timestamp: {
    label: "Timestamp",
    dataType: "datetime",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "event_timestamp",
      filterBy: "date-range",
      filterOperation: "eq",
    },
    visible: true,
    hidable: false,
    cellComponent: LogTimestampCell,
  },
  actor_account_id: {
    label: "Account",
    dataType: "number",
    clickable: false,
    sortable: false,
    filterable: true,
    filterOptions: {
      filterKey: "actor_account_id",
      filterBy: "datasource",
      filterOperation: "eq",
    },
    visible: true,
    hidable: false,
    filterComponent: FilterByAccount,
    cellComponent: LogActorAccountCell,
  },
  action: {
    label: "Action",
    dataType: "enum",
    clickable: false,
    sortable: false,
    filterable: true,
    filterOptions: {
      filterKey: "action",
      filterBy: "multiple-select",
      filterOperation: "in",
      choices: logActions,
    },
    visible: true,
    hidable: false,
    cellComponent: LogActionCell,
  },
  resource_type: {
    label: "Resource Type",
    dataType: "enum",
    clickable: false,
    sortable: false,
    filterable: true,
    filterOptions: {
      filterKey: "resource_type",
      filterBy: "multiple-select",
      filterOperation: "in",
      choices: logResourceTypes,
    },
    visible: true,
    hidable: false,
  },
};
