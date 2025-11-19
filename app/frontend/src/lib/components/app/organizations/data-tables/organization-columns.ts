import OrganizationNameCell from "@/components/app/organizations/data-tables/organization-name-cell.svelte";

import { OrganizationRecord } from "@/data/model/iam/organizations/record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const organizationColumns: ColumnsSettings<OrganizationRecord> = {
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
    cellComponent: OrganizationNameCell,
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
};
