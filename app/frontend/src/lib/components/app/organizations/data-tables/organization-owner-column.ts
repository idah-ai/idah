import OrganizationOwnerRowActionCell from "@/components/app/organizations/data-tables/organization-owner-row-action-cell.svelte";

import { AccountRecord } from "@/data/model/iam/accounts/record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const organizationOwnerColumns: ColumnsSettings<AccountRecord> = {
  email: {
    label: "Email",
    dataType: "email",
    clickable: false,
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
  created_at: {
    label: "Added At",
    dataType: "datetime",
    clickable: false,
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "added_at",
      filterBy: "date-range",
      filterOperation: "gte",
    },
    visible: true,
    hidable: false,
  },
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
