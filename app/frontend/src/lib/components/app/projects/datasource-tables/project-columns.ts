import FilterByOrganization from "@/components/app/datasource-table/filters/filter-by-organization.svelte";
import ProjectDatasetsCell from "@/components/app/projects/datasource-tables/project-datasets-cell.svelte";
import ProjectNameCell from "@/components/app/projects/datasource-tables/project-name-cell.svelte";
import ProjectOrganizationCell from "@/components/app/projects/datasource-tables/project-organization-cell.svelte";
import ProjectRowActionCell from "@/components/app/projects/datasource-tables/project-row-action-cell.svelte";

import { ProjectRecord } from "@/data/model/dataset/projects/project-record";

import type { ColumnSettings, ColumnsSettings } from "@/components/app/datasource-table/types";

export const projectNameColumn: ColumnSettings<ProjectRecord> = {
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
};

export const projectCreatedAtColumn: ColumnSettings<ProjectRecord> = {
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
};

export const projectColumns: ColumnsSettings<ProjectRecord> = {
  name: projectNameColumn,
  organization_id: {
    label: "Organization",
    dataType: "number",
    sortable: true,
    filterable: true,
    filterOptions: {
      filterKey: "organization_id",
      filterBy: "multiple-select",
      filterOperation: "in",
    },
    visible: true,
    hidable: false,
    filterComponent: FilterByOrganization,
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
  created_at: projectCreatedAtColumn,
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
