import AccountJoinedAtCell from "@/components/app/iam/accounts/data-tables/account-joined-at-cell.svelte";
import AccountRowActionCell from "@/components/app/iam/accounts/data-tables/account-row-action-cell.svelte";
import AccountStatusCell from "@/components/app/iam/accounts/data-tables/account-status-cell.svelte";

import { AccountRecord } from "@/data/model/iam/accounts/record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

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
  email: {
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
