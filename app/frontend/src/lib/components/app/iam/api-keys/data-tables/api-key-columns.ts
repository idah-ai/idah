import type { Component } from "svelte";

import ApiKeyCell from "@/components/app/iam/api-keys/data-tables/api-key-cell.svelte";
import ApiKeyPermissionsCell from "@/components/app/iam/api-keys/data-tables/api-key-permissions-cell.svelte";
import ApiKeyRowActionCell from "@/components/app/iam/api-keys/data-tables/api-key-row-action-cell.svelte";
import ApiKeyScopeTypeCell from "@/components/app/iam/api-keys/data-tables/api-key-scope-type-cell.svelte";
import ApiKeyStatusCell from "@/components/app/iam/api-keys/data-tables/api-key-status-cell.svelte";

import { ApiKeyRecord } from "@/data/model/iam/api-keys/record";

import type { ColumnSettings, ColumnsSettings, DataTableCellBaseProps } from "@/components/app/datasource-table/types";

export const apiKeyDatetimeColumn = (params: { label: string }): ColumnSettings<ApiKeyRecord> => {
  const { label = "Created At" } = params;
  return {
    label,
    dataType: "datetime",
    clickable: false,
    sortable: true,
    filterable: true,
    visible: true,
    hidable: false,
  };
};

export const apiKeyDateColumn = (params: {
  label: string;
  cellComponent?: Component<DataTableCellBaseProps<ApiKeyRecord>, object, "">;
}): ColumnSettings<ApiKeyRecord> => {
  const { label = "Last Used", cellComponent } = params;
  return {
    label,
    dataType: "date",
    clickable: false,
    sortable: true,
    visible: true,
    hidable: false,
    filterable: true,
    cellComponent,
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
  status: {
    label: "Status",
    dataType: "enum",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ApiKeyStatusCell,
  },
  last_used_at: apiKeyDatetimeColumn({ label: "Last Used" }),
  created_at: apiKeyDatetimeColumn({ label: "Created At" }),
  expires_at: apiKeyDateColumn({ label: "Expired At" }),
  action: {
    label: "Action",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ApiKeyRowActionCell,
  },
};
