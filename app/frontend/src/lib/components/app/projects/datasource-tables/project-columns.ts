import ProjectDatasetsCell from "@/components/app/projects/datasource-tables/project-datasets-cell.svelte";
import ProjectNameCell from "@/components/app/projects/datasource-tables/project-name-cell.svelte";
import ProjectOrganizationCell from "@/components/app/projects/datasource-tables/project-organization-cell.svelte";
import ProjectRowActionCell from "@/components/app/projects/datasource-tables/project-row-action-cell.svelte";

import type { ColumnsSettings } from "@/components/app/datasource-table/types";
import type { ProjectRecord } from "@/data/model/dataset/projects/project-record";

export const projectColumns: ColumnsSettings<ProjectRecord> = {
  name: {
    label: "Project name",
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
    cellComponent: ProjectNameCell,
  },
  organization_id: {
    label: "Organization ID",
    dataType: "number",
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "organization_id",
      filterBy: "string",
      filterOperation: "eq",
    },
    visible: true,
    hidable: false,
    cellComponent: ProjectOrganizationCell,
  },
  datasets: {
    label: "Datasets",
    dataType: "number",
    sortable: false,
    filterable: false,
    visible: true,
    hidable: false,
    cellComponent: ProjectDatasetsCell,
  },
  created_at: {
    label: "Created At",
    dataType: "datetime",
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "created_at",
      filterBy: "date-range",
      filterOperation: "match",
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
    cellComponent: ProjectRowActionCell,
  },
};
