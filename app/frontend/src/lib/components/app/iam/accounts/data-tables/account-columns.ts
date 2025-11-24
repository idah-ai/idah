import AccountJoinedAtCell from "@/components/app/iam/accounts/data-tables/account-joined-at-cell.svelte";
import AccountRoleNameCell from "@/components/app/iam/accounts/data-tables/account-role-name-cell.svelte";
import AccountRowActionCell from "@/components/app/iam/accounts/data-tables/account-row-action-cell.svelte";
import AccountStatusCell from "@/components/app/iam/accounts/data-tables/account-status-cell.svelte";

import { roles } from "@/data/model/iam/accounts/constants";
import { AccountRecord } from "@/data/model/iam/accounts/record";

import type { ColumnSettings, ColumnsSettings } from "@/components/app/datasource-table/types";

export const accountEmailColumn: ColumnSettings<AccountRecord> = {
  label: "Email",
  dataType: "email",
  clickable: true,
  sortable: true,
  filterable: true,
  filterOptions: {
    filterKey: "email",
    filterBy: "string",
    filterOperation: "match",
  },
  visible: true,
  hidable: false,
};

export const accountCreatedAtColumn = (params: { label: string }): ColumnSettings<AccountRecord> => {
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

export const accountColumns: ColumnsSettings<AccountRecord> = {
  name: {
    label: "Name",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "name",
      filterBy: "string",
      filterOperation: "match",
    },
    visible: true,
    hidable: false,
  },
  email: accountEmailColumn,
  role_name: {
    label: "Role",
    dataType: "string",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "role_name",
      filterBy: "multiple-select",
      filterOperation: "in",
      choices: roles,
    },
    visible: true,
    hidable: false,
    cellComponent: AccountRoleNameCell,
  },
  enabled: {
    label: "Status",
    dataType: "boolean",
    clickable: false,
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
    cellComponent: AccountStatusCell,
  },
  joined_at: {
    label: "Joined At",
    dataType: "datetime",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "joined_at",
      filterBy: "date-range",
      filterOperation: "gte",
    },
    visible: true,
    hidable: false,
    cellComponent: AccountJoinedAtCell,
  },
  created_at: accountCreatedAtColumn({ label: "Created At" }),
  action: {
    label: "Action",
    dataType: "string",
    clickable: false,
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: AccountRowActionCell,
  },
};
