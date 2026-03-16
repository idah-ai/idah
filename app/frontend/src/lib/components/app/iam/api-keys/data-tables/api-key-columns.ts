import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

import type { ColumnSettings, ColumnsSettings } from "@/components/app/datasource-table/types";

export const apiKeyNameColumn: ColumnSettings<ApiKeyRecord> = {
  label: "Name",
  dataType: "string",
  clickable: false,
  sortable: true,
  filterable: false,
  visible: true,
  hidable: false,
};

export const accountCreatedAtColumn = (params: { label: string }): ColumnSettings<ApiKeyRecord> => {
  const { label = "Created At" } = params;
  return {
    label,
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
  };
};

export const apiKeyColumns: ColumnsSettings<ApiKeyRecord> = {
  name: apiKeyNameColumn,
  api_key: {
    label: "API Key",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: false,
    visible: true,
    hidable: false,
  },
  scope_type: {
    label: "Scope Type",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: false,
    visible: true,
    hidable: false,
  },
  permissions: {
    label: "Permissions",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: false,
    visible: true,
    hidable: false,
  },
  last_used: accountCreatedAtColumn({ label: "Last Used" }),
  created_at: accountCreatedAtColumn({ label: "Created At" }),
  expire_at: {
    label: "Expired At",
    dataType: "datetime",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "expire_at",
      filterBy: "date-range",
      filterOperation: "gte",
    },
    visible: true,
    hidable: false,
  },
  action: {
    label: "Action",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
  },
};
