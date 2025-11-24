import AuditActionCell from "@/components/app/audit/audits/datasource-tables/audit-action-cell.svelte";
import AuditTimestampCell from "@/components/app/audit/audits/datasource-tables/audit-timestamp-cell.svelte";

import { AuditRecord } from "@/data/model/audit/audits/record";

import { auditActions, auditResourceTypes } from "@/data/model/audit/audits/constants";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const auditColumns: ColumnsSettings<AuditRecord> = {
  timestamp: {
    label: "Timestamp",
    dataType: "datetime",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "timestamp",
      filterBy: "date-range",
      filterOperation: "eq",
    },
    visible: true,
    hidable: false,
    cellComponent: AuditTimestampCell,
  },
  email: {
    label: "User Email",
    dataType: "email",
    clickable: false,
    sortable: false,
    filterable: true,
    filterOptions: {
      filterKey: "email",
      filterBy: "string",
      filterOperation: "match",
    },
    visible: true,
    hidable: false,
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
      choices: auditActions,
    },
    visible: true,
    hidable: false,
    cellComponent: AuditActionCell,
  },
  resource_type: {
    label: "Resource Type",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: true,
    filterOptions: {
      filterKey: "resource_type",
      filterBy: "multiple-select",
      filterOperation: "match",
      choices: auditResourceTypes,
    },
    visible: true,
    hidable: false,
  },
};
