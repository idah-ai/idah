import OrganizationProjectNameCell from "@/components/app/organizations/data-tables/organization-project-name-cell.svelte";

import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";

export const organizationProjectColumns: ColumnsSettings<ProjectRecord> = {
  name: {
    label: "Project Name",
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
    cellComponent: OrganizationProjectNameCell,
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
