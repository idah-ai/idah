import OrganizationOwnerRowActionCell from "@/components/app/organizations/data-tables/organization-owner-row-action-cell.svelte";

import {
  accountCreatedAtColumn,
  accountEmailColumn,
  accountNameColumn,
} from "@/components/app/iam/accounts/data-tables/account-columns";
import { AccountRecord } from "@/data/model/iam/accounts/record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const organizationOwnerColumns: ColumnsSettings<AccountRecord> = {
  name: accountNameColumn,
  email: accountEmailColumn,
  created_at: accountCreatedAtColumn({ label: "Added At" }),
  action: {
    label: "Action",
    dataType: "string",
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: OrganizationOwnerRowActionCell,
  },
};
