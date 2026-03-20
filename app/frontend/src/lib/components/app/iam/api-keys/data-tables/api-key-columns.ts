import ApiKeyCell from "@/components/app/iam/api-keys/data-tables/api-key-cell.svelte";
import ApiKeyPermissionsCell from "@/components/app/iam/api-keys/data-tables/api-key-permissions-cell.svelte";
import ApiKeyScopeTypeCell from "@/components/app/iam/api-keys/data-tables/api-key-scope-type-cell.svelte";

import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

import type { ColumnSettings, ColumnsSettings } from "@/components/app/datasource-table/types";

export const apiKeyCreatedAtColumn = (params: { label: string }): ColumnSettings<ApiKeyRecord> => {
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

export const apiKeyLastUsedColumn = (params: { label: string }): ColumnSettings<ApiKeyRecord> => {
  const { label = "Last Used" } = params;
  return {
    label,
    dataType: "datetime",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "last_used",
      filterBy: "date-range",
      filterOperation: "gte",
    },
    visible: true,
    hidable: false,
  };
};

export const apiKeyColumns: ColumnsSettings<ApiKeyRecord> = {
  name: {
    label: "Name",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: false,
    visible: true,
    hidable: false,
  },
  key_label: {
    label: "API Key",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ApiKeyCell,
  },
  scope_type: {
    label: "Scope Type",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ApiKeyScopeTypeCell,
  },
  permissions: {
    label: "Permissions",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ApiKeyPermissionsCell,
  },
  last_used: apiKeyLastUsedColumn({ label: "Last Used" }),
  created_at: apiKeyCreatedAtColumn({ label: "Created At" }),
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
